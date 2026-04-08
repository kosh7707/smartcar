import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { WsAnalysisMessage } from "@aegis/shared";
import { runAnalysis, getWsBaseUrl, logError } from "../api/client";
import { fetchAnalysisStatus } from "../api/analysis";
import { createSeqTracker, parseWsMessage, createReconnectingWs } from "../utils/wsEnvelope";
import type { ConnectionState, ReconnectableHookResult } from "../utils/wsEnvelope";

export type AnalysisStage =
  | "idle"
  | "quick_sast"
  | "quick_complete"
  | "deep_submitting"
  | "deep_analyzing"
  | "deep_complete"
  | "error";

const RUNNING_STAGES = new Set<AnalysisStage>(["quick_sast", "quick_complete", "deep_submitting", "deep_analyzing"]);

const PHASE_LABELS: Record<string, string> = {
  quick_sast: "빌드 + SAST 스캔 중...",
  quick_complete: "빠른 분석 완료",
  deep_submitting: "심층 분석 에이전트 호출 중...",
  deep_analyzing: "에이전트가 분석 중... (SAST + 코드그래프 + SCA + LLM)",
  deep_complete: "심층 분석 완료",
};

export interface AnalysisWsState {
  analysisId: string | null;
  stage: AnalysisStage;
  message: string;
  quickFindingCount: number | null;
  deepFindingCount: number | null;
  error: string | null;
  errorPhase: "quick" | "deep" | null;
  targetName: string | null;
  targetProgress: { current: number; total: number } | null;
}

const INITIAL_STATE: AnalysisWsState = {
  analysisId: null,
  stage: "idle",
  message: "",
  quickFindingCount: null,
  deepFindingCount: null,
  error: null,
  errorPhase: null,
  targetName: null,
  targetProgress: null,
};

export function useAnalysisWebSocket(): AnalysisWsState & ReconnectableHookResult & {
  isRunning: boolean;
  startAnalysis: (projectId: string, targetIds?: string[], mode?: "full" | "subproject") => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<AnalysisWsState>(INITIAL_STATE);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const rwsRef = useRef<ReturnType<typeof createReconnectingWs> | null>(null);
  const analysisIdRef = useRef<string | null>(null);

  const isRunning = RUNNING_STAGES.has(state.stage);

  const cleanup = useCallback(() => {
    if (rwsRef.current) {
      rwsRef.current.close();
      rwsRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  function wireWsHandlers(ws: WebSocket | null, seqTracker: ReturnType<typeof createSeqTracker>) {
    if (!ws) return;
    ws.onmessage = (evt) => {
      try {
        const parsed = parseWsMessage(evt.data);
        seqTracker.check(parsed.meta);
        const msg = parsed as unknown as WsAnalysisMessage;
        switch (msg.type) {
          case "analysis-progress": {
            const { phase, message: msg2, targetName, targetProgress } = msg.payload;
            setState((prev) => ({
              ...prev,
              stage: (RUNNING_STAGES.has(phase as AnalysisStage) ? phase : prev.stage) as AnalysisStage,
              message: PHASE_LABELS[phase] ?? msg2 ?? prev.message,
              targetName: targetName ?? prev.targetName,
              targetProgress: targetProgress ?? prev.targetProgress,
            }));
            break;
          }
          case "analysis-quick-complete":
            setState((prev) => ({
              ...prev,
              stage: "quick_complete",
              message: PHASE_LABELS.quick_complete,
              quickFindingCount: msg.payload.findingCount,
            }));
            break;
          case "analysis-deep-complete":
            setState((prev) => ({
              ...prev,
              stage: "deep_complete",
              message: PHASE_LABELS.deep_complete,
              deepFindingCount: msg.payload.findingCount,
            }));
            cleanup();
            break;
          case "analysis-error":
            setState((prev) => ({
              ...prev,
              stage: "error",
              message: "",
              error: msg.payload.error,
              errorPhase: (msg.payload.phase ?? null) as "quick" | "deep" | null,
              targetName: null,
              targetProgress: null,
            }));
            cleanup();
            break;
        }
      } catch (e) {
        console.warn("[WS:analysis] malformed message:", e);
      }
    };
  }

  const startAnalysis = useCallback(async (projectId: string, targetIds?: string[], mode?: "full" | "subproject") => {
    cleanup();
    setState({
      ...INITIAL_STATE,
      stage: "quick_sast",
      message: "분석 준비 중...",
    });

    try {
      const { analysisId } = await runAnalysis(projectId, targetIds, mode);
      analysisIdRef.current = analysisId;
      setState((prev) => ({ ...prev, analysisId }));

      const wsUrl = `${getWsBaseUrl()}/ws/analysis?analysisId=${analysisId}`;
      const seqTracker = createSeqTracker("analysis");

      const rws = createReconnectingWs(() => wsUrl, {
        maxRetries: 10,
        onStateChange: setConnectionState,
        onDisconnect() {
          seqTracker.reset();
        },
        async onReconnect() {
          // REST fallback: restore state from analysis status endpoint
          try {
            const status = await fetchAnalysisStatus(analysisId);
            setState((prev) => {
              if (prev.stage === "deep_complete" || prev.stage === "error") return prev;
              const phase = status.phase as AnalysisStage;
              return {
                ...prev,
                stage: RUNNING_STAGES.has(phase) ? phase : prev.stage,
                message: PHASE_LABELS[phase] ?? prev.message,
              };
            });
          } catch (e) {
            logError("Analysis recovery", e);
          }
          // Re-wire message handlers on new WS
          wireWsHandlers(rws.getWs(), seqTracker);
        },
        onGiveUp() {
          setState((prev) => {
            if (!RUNNING_STAGES.has(prev.stage)) return prev;
            return {
              ...prev,
              stage: "error",
              error: "WebSocket 연결이 끊어졌습니다.",
            };
          });
        },
      });
      rwsRef.current = rws;
      wireWsHandlers(rws.getWs(), seqTracker);
    } catch (e) {
      logError("Start analysis", e);
      setState({
        ...INITIAL_STATE,
        stage: "error",
        error: e instanceof Error ? e.message : "분석 실행에 실패했습니다.",
      });
    }
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setState(INITIAL_STATE);
    setConnectionState("disconnected");
    analysisIdRef.current = null;
  }, [cleanup]);

  return useMemo(
    () => ({ ...state, connectionState, isRunning, startAnalysis, reset }),
    [state, connectionState, isRunning, startAnalysis, reset],
  );
}
