import { useState, useCallback, useRef, useEffect } from "react";
import type { BuildTargetStatus, PipelinePhase, WsPipelineMessage } from "@aegis/shared";
import { runPipeline, runPipelineTarget, getWsBaseUrl, logError } from "../api/client";
import { createSeqTracker } from "../utils/wsEnvelope";

export interface PipelineTargetState {
  name: string;
  status: BuildTargetStatus;
  phase: PipelinePhase;
  message: string;
  error?: string;
}

export interface PipelineState {
  targets: Map<string, PipelineTargetState>;
  isRunning: boolean;
  readyCount: number;
  failedCount: number;
  totalCount: number;
  pipelineId: string | null;
}

const INITIAL: PipelineState = {
  targets: new Map(),
  isRunning: false,
  readyCount: 0,
  failedCount: 0,
  totalCount: 0,
  pipelineId: null,
};

function toFailedStatus(
  phase: PipelinePhase,
  existingStatus?: BuildTargetStatus,
): BuildTargetStatus {
  if (existingStatus?.endsWith("_failed")) return existingStatus;
  if (phase === "setup") return "resolve_failed";
  return "build_failed";
}

export function usePipelineProgress() {
  const [state, setState] = useState<PipelineState>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const connectWs = useCallback((projectId: string) => {
    cleanup();
    const wsUrl = `${getWsBaseUrl()}/ws/pipeline?projectId=${encodeURIComponent(projectId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const seqTracker = createSeqTracker("pipeline");

    ws.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data);
        seqTracker.check(parsed.meta);
        const msg: WsPipelineMessage = parsed;
        switch (msg.type) {
          case "pipeline-target-status":
            setState((prev) => {
              const next = new Map(prev.targets);
              next.set(msg.payload.targetId, {
                name: msg.payload.targetName,
                status: msg.payload.status,
                phase: msg.payload.phase,
                message: msg.payload.message,
              });
              return { ...prev, targets: next };
            });
            break;
          case "pipeline-complete":
            setState((prev) => ({
              ...prev,
              isRunning: false,
              readyCount: msg.payload.readyCount,
              failedCount: msg.payload.failedCount,
              totalCount: msg.payload.totalCount,
            }));
            cleanup();
            break;
          case "pipeline-error":
            setState((prev) => {
              const next = new Map(prev.targets);
              const existing = next.get(msg.payload.targetId);
              next.set(msg.payload.targetId, {
                ...existing,
                name: msg.payload.targetName,
                status: toFailedStatus(msg.payload.phase as PipelinePhase, existing?.status),
                phase: msg.payload.phase as PipelinePhase,
                message: "",
                error: msg.payload.error,
              });
              return { ...prev, targets: next };
            });
            break;
        }
      } catch (e) {
        console.warn("[WS:pipeline] malformed message:", e);
      }
    };

    ws.onerror = () => console.warn("[WS:pipeline] connection error");

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [cleanup]);

  const startPipeline = useCallback(async (projectId: string, targetIds?: string[]) => {
    setState({ ...INITIAL, isRunning: true, pipelineId: null });
    try {
      const { pipelineId } = await runPipeline(projectId, targetIds);
      setState((prev) => ({ ...prev, pipelineId }));
      connectWs(projectId);
    } catch (e) {
      logError("Start pipeline", e);
      setState((prev) => ({ ...prev, isRunning: false }));
      throw e;
    }
  }, [connectWs]);

  const retryTarget = useCallback(async (projectId: string, targetId: string) => {
    try {
      await runPipelineTarget(projectId, targetId);
      // Re-connect WS if not connected
      if (!wsRef.current) connectWs(projectId);
      setState((prev) => ({ ...prev, isRunning: true }));
    } catch (e) {
      logError("Retry pipeline target", e);
      throw e;
    }
  }, [connectWs]);

  const reset = useCallback(() => {
    cleanup();
    setState(INITIAL);
  }, [cleanup]);

  return { ...state, startPipeline, retryTarget, reset };
}
