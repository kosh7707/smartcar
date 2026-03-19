import { useState, useCallback, useRef, useEffect } from "react";
import type { WsAnalysisMessage } from "@aegis/shared";
import { runAnalysis, getWsBaseUrl, logError } from "../api/client";

export type AnalysisStage =
  | "idle"
  | "quick_sast"
  | "quick_complete"
  | "deep_submitting"
  | "deep_analyzing"
  | "deep_complete"
  | "error";

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
  retryable: boolean;
  isRunning: boolean;
}

const INITIAL_STATE: AnalysisWsState = {
  analysisId: null,
  stage: "idle",
  message: "",
  quickFindingCount: null,
  deepFindingCount: null,
  error: null,
  errorPhase: null,
  retryable: false,
  isRunning: false,
};

export function useAnalysisWebSocket() {
  const [state, setState] = useState<AnalysisWsState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startAnalysis = useCallback(async (projectId: string) => {
    cleanup();
    setState({
      ...INITIAL_STATE,
      stage: "quick_sast",
      message: "분석 준비 중...",
      isRunning: true,
    });

    try {
      const { analysisId } = await runAnalysis(projectId);

      setState((prev) => ({ ...prev, analysisId }));

      // Connect WebSocket
      const wsUrl = `${getWsBaseUrl()}/ws/analysis?analysisId=${analysisId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg: WsAnalysisMessage = JSON.parse(evt.data);
          switch (msg.type) {
            case "analysis-progress":
              setState((prev) => ({
                ...prev,
                stage: msg.payload.phase as AnalysisStage,
                message: PHASE_LABELS[msg.payload.phase] ?? msg.payload.message ?? prev.message,
              }));
              break;
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
                isRunning: false,
              }));
              cleanup();
              break;
            case "analysis-error":
              setState((prev) => ({
                ...prev,
                stage: "error",
                message: "",
                error: msg.payload.error,
                errorPhase: msg.payload.phase as "quick" | "deep" | null,
                retryable: msg.payload.retryable ?? false,
                isRunning: false,
              }));
              cleanup();
              break;
          }
        } catch (e) {
          console.warn("[WS:analysis] malformed message:", e);
        }
      };

      ws.onerror = () => {
        console.warn("[WS:analysis] connection error");
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    } catch (e) {
      logError("Start analysis", e);
      setState({
        ...INITIAL_STATE,
        stage: "error",
        error: e instanceof Error ? e.message : "분석 실행에 실패했습니다.",
        retryable: true,
      });
    }
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setState(INITIAL_STATE);
  }, [cleanup]);

  return { ...state, startAnalysis, reset };
}
