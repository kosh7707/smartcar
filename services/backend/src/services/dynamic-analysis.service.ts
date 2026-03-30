import crypto from "crypto";
import type {
  CanMessage,
  DynamicAlert,
  DynamicAnalysisSession,
  AnalysisResult,
  Vulnerability,
  Severity,
  CanInjectionRequest,
  CanInjectionResponse,
  InjectionClassification,
  AttackScenario,
  AttackScenarioId,
} from "@aegis/shared";
import { CanRuleEngine } from "../can-rules/can-rule-engine";
import type { CanRuleMatch } from "../can-rules/types";
import type { LlmTaskClient, TaskRequest, TaskResponseSuccess } from "./llm-task-client";
import { validateLlmSeverity } from "../lib/vulnerability-utils";
import type { WsBroadcaster } from "./ws-broadcaster";
import type { AdapterManager } from "./adapter-manager";
import type { ProjectSettingsService } from "./project-settings.service";
import type { IDynamicSessionDAO, IDynamicAlertDAO, IDynamicMessageDAO, IAnalysisResultDAO } from "../dao/interfaces";
import { ATTACK_SCENARIOS } from "./attack-scenarios";
import type { ResultNormalizer } from "./result-normalizer";
import { createLogger, generateRequestId } from "../lib/logger";
import {
  NotFoundError,
  InvalidInputError,
  AdapterUnavailableError,
} from "../lib/errors";
import { computeSummary } from "../lib/vulnerability-utils";

const logger = createLogger("dynamic-analysis");

const RECENT_BUFFER_SIZE = 100;
const ALERT_LLM_THRESHOLD = 3;
const CONTEXT_WINDOW = 20;

interface ActiveSession {
  id: string;
  projectId: string;
  adapterId: string;
  recentMessages: CanMessage[];
  messageCount: number;
  alertCount: number;
  alertsSinceLastLlm: number;
  injectionHistory: CanInjectionResponse[];
  injectionCount: number;
}

export class DynamicAnalysisService {
  private activeSessions = new Map<string, ActiveSession>();

  constructor(
    private dynamicSessionDAO: IDynamicSessionDAO,
    private dynamicAlertDAO: IDynamicAlertDAO,
    private dynamicMessageDAO: IDynamicMessageDAO,
    private analysisResultDAO: IAnalysisResultDAO,
    private canRuleEngine: CanRuleEngine,
    private llmClient: LlmTaskClient,
    private ws: WsBroadcaster<import("@aegis/shared").WsMessage>,
    private adapterManager: AdapterManager,
    private settingsService: ProjectSettingsService,
    private resultNormalizer?: ResultNormalizer
  ) {
    // Adapter에서 CAN 프레임 수신 -> 해당 어댑터에 바인딩된 세션에만 라우팅
    this.adapterManager.setCanFrameHandler((adapterId, frame) => {
      for (const [sessionId, active] of this.activeSessions) {
        if (active.adapterId !== adapterId) continue;
        this.handleCanMessage(sessionId, {
          timestamp: frame.timestamp,
          id: frame.id,
          dlc: frame.dlc,
          data: frame.data,
          flagged: false,
        });
      }
    });
  }

  // --- 세션 관리 ---

  createSession(projectId: string, adapterId: string): DynamicAnalysisSession {
    const adapter = this.adapterManager.findById(adapterId);
    if (!adapter) throw new NotFoundError("Adapter not found");
    if (adapter.projectId !== projectId) throw new InvalidInputError("Adapter does not belong to this project");
    if (!adapter.connected) throw new AdapterUnavailableError("Adapter is not connected");

    const session: DynamicAnalysisSession = {
      id: `dyn-${crypto.randomUUID()}`,
      projectId,
      status: "connected",
      source: { type: "adapter", adapterId: adapter.id, adapterName: adapter.name },
      messageCount: 0,
      alertCount: 0,
      startedAt: new Date().toISOString(),
    };
    this.dynamicSessionDAO.save(session);
    return session;
  }

  startSession(sessionId: string): DynamicAnalysisSession | undefined {
    const session = this.dynamicSessionDAO.findById(sessionId);
    if (!session || session.status !== "connected") return undefined;

    this.dynamicSessionDAO.updateStatus(sessionId, "monitoring");
    this.canRuleEngine.resetAll();

    const active: ActiveSession = {
      id: sessionId,
      projectId: session.projectId,
      adapterId: session.source.adapterId,
      recentMessages: [],
      messageCount: 0,
      alertCount: 0,
      alertsSinceLastLlm: 0,
      injectionHistory: [],
      injectionCount: 0,
    };

    this.activeSessions.set(sessionId, active);
    return { ...session, status: "monitoring" };
  }

  async stopSession(sessionId: string, requestId?: string): Promise<DynamicAnalysisSession | undefined> {
    const session = this.dynamicSessionDAO.findById(sessionId);
    if (!session || session.status === "stopped") return undefined;

    const endedAt = new Date().toISOString();
    this.dynamicSessionDAO.stop(sessionId, endedAt);

    // 전체 로그 LLM 종합 분석
    await this.runFinalLlmAnalysis(sessionId, session.projectId, requestId, session.startedAt);

    this.activeSessions.delete(sessionId);

    return this.dynamicSessionDAO.findById(sessionId);
  }

  findSession(sessionId: string) {
    const session = this.dynamicSessionDAO.findById(sessionId);
    if (!session) return undefined;

    const alerts = this.dynamicAlertDAO.findBySessionId(sessionId);
    const recentMessages = this.dynamicMessageDAO.findRecent(sessionId, 50);

    return { session, alerts, recentMessages };
  }

  findAllSessions(projectId?: string): DynamicAnalysisSession[] {
    if (projectId) return this.dynamicSessionDAO.findByProjectId(projectId);
    return this.dynamicSessionDAO.findAll();
  }

  // --- CAN 메시지 처리 ---

  private handleCanMessage(sessionId: string, msg: CanMessage): void {
    const active = this.activeSessions.get(sessionId);
    if (!active) return;

    // circular buffer
    active.recentMessages.push(msg);
    if (active.recentMessages.length > RECENT_BUFFER_SIZE) {
      active.recentMessages.shift();
    }

    // 1계층: 룰 평가
    const matches = this.canRuleEngine.evaluateMessage(msg, active.recentMessages);

    // flagged 처리
    const flagged = matches.length > 0;
    const storedMsg: CanMessage = { ...msg, flagged };

    // DB 저장
    this.dynamicMessageDAO.save(sessionId, storedMsg);
    active.messageCount++;

    // S1에 메시지 push
    this.ws.broadcast(sessionId, {
      type: "message",
      payload: storedMsg,
    });

    // alert 처리
    for (const match of matches) {
      this.handleAlert(active, match);
    }

    // 주기적으로 DB 카운트 업데이트 (매 100건)
    if (active.messageCount % 100 === 0) {
      this.dynamicSessionDAO.updateCounts(sessionId, active.messageCount, active.alertCount);
    }

    // 상태 push (매 20건)
    if (active.messageCount % 20 === 0) {
      this.ws.broadcast(sessionId, {
        type: "status",
        payload: {
          messageCount: active.messageCount,
          alertCount: active.alertCount,
        },
      });
    }
  }

  private handleAlert(active: ActiveSession, match: CanRuleMatch): void {
    const alert: DynamicAlert = {
      id: `alert-${crypto.randomUUID()}`,
      severity: match.severity,
      title: match.title,
      description: match.description,
      relatedMessages: match.relatedMessages,
      detectedAt: new Date().toISOString(),
    };

    this.dynamicAlertDAO.save(alert, active.id);
    active.alertCount++;
    active.alertsSinceLastLlm++;

    // S1에 alert push
    this.ws.broadcast(active.id, {
      type: "alert",
      payload: alert,
    });

    // 2계층: alert 누적 문턱값 도달 시 LLM 분석
    if (active.alertsSinceLastLlm >= ALERT_LLM_THRESHOLD) {
      const canRequestId = generateRequestId("can");
      logger.info({ requestId: canRequestId, sessionId: active.id, alertId: alert.id }, "CAN alert threshold reached — triggering LLM analysis");
      this.runContextLlmAnalysis(active, alert, canRequestId)
        .catch((err) => logger.warn({ err, requestId: canRequestId, sessionId: active.id }, "Context LLM analysis failed"));
    }
  }

  // --- 2계층 LLM 분석 ---

  private async runContextLlmAnalysis(active: ActiveSession, triggerAlert: DynamicAlert, requestId?: string): Promise<void> {
    active.alertsSinceLastLlm = 0;

    const llmUrl = this.settingsService.get(active.projectId, "llmUrl");

    // 전후 컨텍스트 추출
    const contextMessages = active.recentMessages.slice(-CONTEXT_WINDOW * 2);
    const canLog = this.messagesToLog(contextMessages);
    const alerts = this.dynamicAlertDAO.findBySessionId(active.id);
    const ruleMatches = alerts.slice(-ALERT_LLM_THRESHOLD).map((a) => ({
      ruleId: a.id,
      title: a.title,
      severity: a.severity,
      location: "CAN bus",
    }));

    const taskRequest = this.buildTaskRequest("dynamic-annotate", { canLog, ruleMatches });
    const res = await this.llmClient.submitTask(taskRequest, requestId, { baseUrl: llmUrl ?? undefined });

    if (res.status === "completed") {
      const success = res as TaskResponseSuccess;
      const llmText = success.result.claims
        .map((c) => `[${success.result.suggestedSeverity ?? "medium"}] ${c.statement}`)
        .join("\n");

      this.dynamicAlertDAO.updateLlmAnalysis(triggerAlert.id, llmText);

      // 업데이트된 alert를 push
      const updated: DynamicAlert = { ...triggerAlert, llmAnalysis: llmText };
      this.ws.broadcast(active.id, { type: "alert", payload: updated });
    }
  }

  private async runFinalLlmAnalysis(sessionId: string, projectId: string, requestId?: string, sessionStartedAt?: string): Promise<void> {
    const allMessages = this.dynamicMessageDAO.findBySessionId(sessionId);
    const alerts = this.dynamicAlertDAO.findBySessionId(sessionId);

    if (allMessages.length === 0) return;

    const llmUrl = this.settingsService.get(projectId, "llmUrl");

    const canLog = this.messagesToLog(allMessages);
    const ruleMatches = alerts.map((a) => ({
      ruleId: a.id,
      title: a.title,
      severity: a.severity,
      location: "CAN bus",
    }));

    let llmSuccess: TaskResponseSuccess | null = null;
    try {
      const taskRequest = this.buildTaskRequest("dynamic-annotate", { canLog, ruleMatches });
      const res = await this.llmClient.submitTask(taskRequest, requestId, { baseUrl: llmUrl ?? undefined });
      if (res.status === "completed") llmSuccess = res as TaskResponseSuccess;
    } catch (err) {
      logger.warn({ err, sessionId }, "Final LLM analysis failed — saving rule-only results");
    }

    // alerts -> Vulnerability 변환
    const vulns: Vulnerability[] = alerts.map((a, i) => ({
      id: `VULN-DYN-RULE-${i}`,
      severity: a.severity,
      title: a.title,
      description: a.description,
      location: "CAN bus",
      source: "rule" as const,
      suggestion: a.llmAnalysis ?? undefined,
    }));

    // LLM 결과 추가
    if (llmSuccess) {
      for (const claim of llmSuccess.result.claims) {
        vulns.push({
          id: `VULN-DYN-LLM-${crypto.randomUUID().slice(0, 8)}`,
          severity: validateLlmSeverity(llmSuccess.result.suggestedSeverity ?? "medium") as Severity,
          title: claim.statement,
          description: claim.statement,
          location: claim.location ?? "CAN bus",
          source: "llm" as const,
          suggestion: llmSuccess.result.recommendedNextSteps[0] ?? undefined,
        });
      }
    }

    const summary = computeSummary(vulns);

    const result: AnalysisResult = {
      id: `analysis-dyn-${sessionId}`,
      projectId,
      module: "dynamic_analysis",
      status: "completed",
      vulnerabilities: vulns,
      summary,
      createdAt: new Date().toISOString(),
    };

    this.analysisResultDAO.save(result);
    this.resultNormalizer?.normalizeAnalysisResult(result, { sessionId, startedAt: sessionStartedAt });
    this.dynamicSessionDAO.updateCounts(
      sessionId,
      this.dynamicMessageDAO.countBySessionId(sessionId),
      alerts.length
    );
  }

  // --- CAN 주입 ---

  async injectMessage(sessionId: string, req: CanInjectionRequest): Promise<CanInjectionResponse> {
    const active = this.activeSessions.get(sessionId);
    if (!active) throw new NotFoundError("Session not found or not active");

    const session = this.dynamicSessionDAO.findById(sessionId);
    if (!session || session.status !== "monitoring") {
      throw new InvalidInputError("Session is not in monitoring state");
    }

    const client = this.adapterManager.getClient(active.adapterId);
    if (!client) throw new AdapterUnavailableError("Adapter client not available");

    // ECU에 메시지 주입
    const ecuResponse = await client.sendAndReceive({
      canId: req.canId,
      dlc: req.dlc,
      data: req.data,
    });

    // 주입 메시지를 CAN 스트림에 투입 (룰 엔진 평가 + WS push 포함)
    const injectedMsg: CanMessage = {
      timestamp: new Date().toISOString(),
      id: req.canId,
      dlc: req.dlc,
      data: req.data,
      flagged: false,
      injected: true,
    };
    this.handleCanMessage(sessionId, injectedMsg);

    // ECU 응답 분류
    const classification = this.classifyResponse(ecuResponse);

    const result: CanInjectionResponse = {
      id: `inj-${crypto.randomUUID().slice(0, 8)}`,
      request: req,
      ecuResponse,
      classification,
      injectedAt: injectedMsg.timestamp,
    };

    // 이력 기록
    active.injectionHistory.push(result);
    active.injectionCount++;

    // WS injection-result 이벤트
    this.ws.broadcast(sessionId, {
      type: "injection-result",
      payload: result,
    });

    return result;
  }

  async injectScenario(sessionId: string, scenarioId: AttackScenarioId): Promise<CanInjectionResponse[]> {
    const scenario = ATTACK_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) throw new InvalidInputError(`Unknown scenario: ${scenarioId}`);

    const results: CanInjectionResponse[] = [];
    for (const step of scenario.steps) {
      const result = await this.injectMessage(sessionId, step);
      results.push(result);
    }
    return results;
  }

  getInjectionHistory(sessionId: string): CanInjectionResponse[] {
    const active = this.activeSessions.get(sessionId);
    if (!active) return [];
    return active.injectionHistory;
  }

  static getAttackScenarios(): AttackScenario[] {
    return ATTACK_SCENARIOS;
  }

  private classifyResponse(ecuResponse: { success: boolean; error?: string; delayMs?: number }): InjectionClassification {
    if (ecuResponse.error === "no_response" || ecuResponse.error === "reset") return "crash";
    if (ecuResponse.error === "malformed") return "anomaly";
    if (ecuResponse.error === "delayed") return "timeout";
    return "normal";
  }

  // --- 유틸 ---

  private buildTaskRequest(
    taskType: "dynamic-annotate",
    data: { canLog: string; ruleMatches: Array<{ ruleId: string; title: string; severity: string; location: string }> },
  ): TaskRequest {
    return {
      taskType,
      taskId: crypto.randomUUID(),
      context: {
        trusted: { ruleMatches: data.ruleMatches },
        untrusted: { rawCanLog: data.canLog },
      },
      evidenceRefs: [
        {
          refId: crypto.randomUUID(),
          artifactId: crypto.randomUUID(),
          artifactType: "raw-can-window",
          locatorType: "frameWindow",
          locator: {},
        },
        ...data.ruleMatches.map((r) => ({
          refId: crypto.randomUUID(),
          artifactId: crypto.randomUUID(),
          artifactType: "rule-match",
          locatorType: "jsonPointer",
          locator: { ruleId: r.ruleId },
        })),
      ],
    };
  }

  private messagesToLog(messages: CanMessage[]): string {
    return messages
      .map((m) => {
        const ts = m.timestamp.includes("T")
          ? m.timestamp.split("T")[1]?.replace("Z", "") ?? m.timestamp
          : m.timestamp;
        const prefix = m.injected ? "[INJ] " : "";
        return `${prefix}${ts} ${m.id} [${m.dlc}] ${m.data}`;
      })
      .join("\n");
  }
}
