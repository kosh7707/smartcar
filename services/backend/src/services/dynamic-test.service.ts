import crypto from "crypto";
import type {
  DynamicTestConfig,
  DynamicTestResult,
  DynamicTestFinding,
  AnalysisResult,
  Vulnerability,
  AnalysisSummary,
  Severity,
} from "@smartcar/shared";
import { LlmClient } from "./llm-client";
import type { WsManager } from "./ws-manager";
import type { AdapterManager } from "./adapter-manager";
import type { ProjectSettingsService } from "./project-settings.service";
import { InputGenerator, type TestInput } from "./input-generator";
import { dynamicTestResultDAO } from "../dao/dynamic-test-result.dao";
import { analysisResultDAO } from "../dao/analysis-result.dao";
import { createLogger } from "../lib/logger";
import {
  NotFoundError,
  InvalidInputError,
  AdapterUnavailableError,
  ConflictError,
} from "../lib/errors";

const logger = createLogger("dynamic-test");

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export class DynamicTestService {
  private runningTests = new Set<string>();
  private inputGenerator = new InputGenerator();

  constructor(
    private llmClient: LlmClient,
    private adapterManager: AdapterManager,
    private settingsService: ProjectSettingsService,
    private wsManager?: WsManager
  ) {}

  async runTest(
    projectId: string,
    config: DynamicTestConfig,
    adapterId: string,
    testId?: string,
    requestId?: string
  ): Promise<DynamicTestResult> {
    const id = testId ?? `test-${crypto.randomUUID()}`;

    // 어댑터 검증
    const adapter = this.adapterManager.findById(adapterId);
    if (!adapter) throw new NotFoundError("Adapter not found");
    if (adapter.projectId !== projectId) throw new InvalidInputError("Adapter does not belong to this project");
    if (!adapter.connected) throw new AdapterUnavailableError("Adapter is not connected");
    const ecuAdapter = this.adapterManager.getClient(adapterId);
    if (!ecuAdapter) throw new AdapterUnavailableError("Adapter client not available");

    // 동시 실행 방지
    if (this.runningTests.has(projectId)) {
      throw new ConflictError("A test is already running for this project");
    }
    this.runningTests.add(projectId);

    try {
      // 초기 레코드 저장
      const now = new Date().toISOString();
      const initialResult: DynamicTestResult = {
        id,
        projectId,
        config,
        status: "running",
        totalRuns: 0,
        crashes: 0,
        anomalies: 0,
        findings: [],
        createdAt: now,
      };
      dynamicTestResultDAO.save(initialResult);

      // 입력 생성
      const inputs = this.inputGenerator.generate(config);

      // 테스트 실행
      const findings: DynamicTestFinding[] = [];
      let crashes = 0;
      let anomalies = 0;

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];

        this.sendProgress(id, i, inputs.length, crashes, anomalies,
          `테스트 ${i + 1}/${inputs.length} 실행 중...`);

        const response = await ecuAdapter.sendAndReceive({
          canId: input.canId,
          dlc: input.dlc,
          data: input.data,
        });

        const finding = this.evaluateResponse(input, response);
        if (finding) {
          findings.push(finding);
          if (finding.type === "crash") crashes++;
          else if (finding.type === "anomaly") anomalies++;
          this.sendFinding(id, finding);
        }
      }

      // LLM 분석 (findings가 있을 때만)
      if (findings.length > 0) {
        await this.runLlmAnalysis(findings, config, projectId, requestId);
      }

      // 최종 결과
      const result: DynamicTestResult = {
        id,
        projectId,
        config,
        status: "completed",
        totalRuns: inputs.length,
        crashes,
        anomalies,
        findings,
        createdAt: now,
      };

      dynamicTestResultDAO.updateResult(id, {
        status: "completed",
        totalRuns: inputs.length,
        crashes,
        anomalies,
        findings,
      });

      // Overview 호환: AnalysisResult로도 저장
      this.saveAsAnalysisResult(result);

      this.sendProgress(id, inputs.length, inputs.length, crashes, anomalies, "테스트 완료");
      this.sendComplete(id);

      return result;
    } finally {
      this.runningTests.delete(projectId);
    }
  }

  findById(testId: string): DynamicTestResult | undefined {
    return dynamicTestResultDAO.findById(testId);
  }

  findByProjectId(projectId: string): DynamicTestResult[] {
    return dynamicTestResultDAO.findByProjectId(projectId);
  }

  deleteById(testId: string): boolean {
    return dynamicTestResultDAO.deleteById(testId);
  }

  // --- 응답 분류 ---

  private evaluateResponse(
    input: TestInput,
    response: { success: boolean; data?: string; error?: string; delayMs?: number }
  ): DynamicTestFinding | null {
    const inputStr = `${input.canId} [${input.dlc}] ${input.data}`;

    if (response.error === "no_response") {
      return {
        id: `finding-${crypto.randomUUID().slice(0, 8)}`,
        severity: "critical",
        type: "crash",
        input: inputStr,
        description: "ECU가 응답하지 않음 - 크래시 가능성",
      };
    }

    if (response.error === "reset") {
      return {
        id: `finding-${crypto.randomUUID().slice(0, 8)}`,
        severity: "critical",
        type: "crash",
        input: inputStr,
        description: "ECU 리셋 발생",
      };
    }

    if (response.error === "malformed") {
      return {
        id: `finding-${crypto.randomUUID().slice(0, 8)}`,
        severity: "high",
        type: "anomaly",
        input: inputStr,
        response: response.data,
        description: "비정상 응답 형식 - 프로토콜 위반",
      };
    }

    if (response.error === "delayed" && response.delayMs && response.delayMs > 1000) {
      return {
        id: `finding-${crypto.randomUUID().slice(0, 8)}`,
        severity: "medium",
        type: "timeout",
        input: inputStr,
        response: response.data,
        description: `응답 지연 (${response.delayMs}ms) - DoS 벡터 가능성`,
      };
    }

    return null;
  }

  // --- LLM 분석 ---

  private async runLlmAnalysis(
    findings: DynamicTestFinding[],
    config: DynamicTestConfig,
    projectId: string,
    requestId?: string
  ): Promise<void> {
    try {
      const llmUrl = this.settingsService.get(projectId, "llmUrl");
      const testResults = this.findingsToTestResults(findings, config);
      const llmRes = await this.llmClient.analyze({
        module: "dynamic_testing",
        testResults,
        ruleResults: findings.map((f) => ({
          ruleId: `TEST-${f.type.toUpperCase()}`,
          title: f.description,
          severity: f.severity,
          location: `${config.targetEcu} (${config.targetId})`,
        })),
      }, llmUrl, requestId);

      if (llmRes.success && llmRes.vulnerabilities.length > 0) {
        // LLM 분석 결과를 각 finding에 매핑
        for (let i = 0; i < findings.length && i < llmRes.vulnerabilities.length; i++) {
          const llmVuln = llmRes.vulnerabilities[i];
          findings[i].llmAnalysis = llmVuln.description;
          if (llmVuln.suggestion) {
            findings[i].llmAnalysis += `\n\n권장 조치: ${llmVuln.suggestion}`;
          }
        }
      }
    } catch (err) {
      // LLM 실패 시 1계층 결과만으로 진행 (graceful degradation)
      logger.warn({ err, projectId }, "Dynamic test LLM analysis failed — using rule-only results");
    }
  }

  private findingsToTestResults(
    findings: DynamicTestFinding[],
    config: DynamicTestConfig
  ): string {
    const header = [
      `테스트 유형: ${config.testType}`,
      `전략: ${config.strategy}`,
      `대상 ECU: ${config.targetEcu}`,
      `프로토콜: ${config.protocol}`,
      `대상 ID: ${config.targetId}`,
      `발견 사항: ${findings.length}건`,
      "",
      "--- 발견 사항 ---",
    ].join("\n");

    const body = findings
      .map(
        (f, i) =>
          `[${i + 1}] [${f.severity}] ${f.type}\n` +
          `    입력: ${f.input}\n` +
          `    응답: ${f.response ?? "없음"}\n` +
          `    설명: ${f.description}`
      )
      .join("\n\n");

    return header + "\n" + body;
  }

  // --- Overview 호환 ---

  private saveAsAnalysisResult(result: DynamicTestResult): void {
    const vulns: Vulnerability[] = result.findings.map((f, i) => ({
      id: `VULN-TEST-${Date.now()}-${i}`,
      severity: f.severity,
      title: `[${f.type.toUpperCase()}] ${f.description.slice(0, 60)}`,
      description:
        f.description +
        (f.llmAnalysis ? `\n\nLLM 분석: ${f.llmAnalysis}` : ""),
      location: `${result.config.targetEcu} (${result.config.targetId})`,
      source: "rule" as const,
      suggestion: f.llmAnalysis ?? undefined,
    }));

    vulns.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    const summary: AnalysisSummary = {
      total: vulns.length,
      critical: vulns.filter((v) => v.severity === "critical").length,
      high: vulns.filter((v) => v.severity === "high").length,
      medium: vulns.filter((v) => v.severity === "medium").length,
      low: vulns.filter((v) => v.severity === "low").length,
      info: vulns.filter((v) => v.severity === "info").length,
    };

    const analysisResult: AnalysisResult = {
      id: `analysis-test-${result.id}`,
      projectId: result.projectId,
      module: "dynamic_testing",
      status: "completed",
      vulnerabilities: vulns,
      summary,
      createdAt: result.createdAt,
    };

    analysisResultDAO.save(analysisResult);
  }

  // --- WS helpers ---

  private sendProgress(
    testId: string,
    current: number,
    total: number,
    crashes: number,
    anomalies: number,
    message: string
  ): void {
    this.wsManager?.broadcastTest(testId, {
      type: "test-progress",
      payload: { testId, current, total, crashes, anomalies, message },
    });
  }

  private sendFinding(testId: string, finding: DynamicTestFinding): void {
    this.wsManager?.broadcastTest(testId, {
      type: "test-finding",
      payload: { testId, finding },
    });
  }

  private sendComplete(testId: string): void {
    this.wsManager?.broadcastTest(testId, {
      type: "test-complete",
      payload: { testId },
    });
  }
}
