import { useState, useCallback, useRef, useEffect } from "react";
import { getWsBaseUrl, logError } from "@/common/api/client";
import { createSeqTracker, parseWsMessage, createReconnectingWs } from "@/common/utils/wsEnvelope";
import type { ConnectionState, ReconnectableHookResult } from "@/common/utils/wsEnvelope";
import { fetchUploadStatus } from "@/common/api/source";
import { ApiError } from "@/common/api/core";

export type UploadPhase = "idle" | "uploading" | "received" | "extracting" | "indexing" | "complete" | "failed";

export interface UploadProgressState {
  phase: UploadPhase;
  message: string;
  fileCount: number | null;
  error: string | null;
}

const INITIAL: UploadProgressState = {
  phase: "idle",
  message: "",
  fileCount: null,
  error: null,
};

const PHASE_LABELS: Record<string, string> = {
  received: "파일 수신 완료",
  extracting: "아카이브 추출 중...",
  indexing: "파일 인덱싱 중...",
  complete: "업로드 완료",
};

export function useUploadProgress(): UploadProgressState & ReconnectableHookResult & {
  isActive: boolean;
  setUploading: () => void;
  startTracking: (uploadId: string, projectId?: string) => void;
  reset: () => void;
} {
  const [state, setState] = useState<UploadProgressState>(INITIAL);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const rwsRef = useRef<ReturnType<typeof createReconnectingWs> | null>(null);

  const cleanup = useCallback(() => {
    if (rwsRef.current) {
      rwsRef.current.close();
      rwsRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startTracking = useCallback((uploadId: string, projectId?: string) => {
    cleanup();
    setState({ phase: "received", message: "서버 처리 중...", fileCount: null, error: null });

    const wsUrl = `${getWsBaseUrl()}/ws/upload?uploadId=${encodeURIComponent(uploadId)}`;
    const seqTracker = createSeqTracker("upload");

    function wireWsHandlers(ws: WebSocket | null) {
      if (!ws) return;
      ws.onmessage = (evt) => {
        try {
          const msg = parseWsMessage(evt.data);
          seqTracker.check(msg.meta);
          switch (msg.type) {
            case "upload-progress":
              setState((prev) => ({
                ...prev,
                phase: msg.payload.phase as UploadPhase,
                message: PHASE_LABELS[msg.payload.phase] ?? msg.payload.message ?? prev.message,
                fileCount: msg.payload.fileCount ?? prev.fileCount,
              }));
              break;
            case "upload-complete":
              setState({
                phase: "complete",
                message: `${msg.payload.fileCount}개 파일 업로드 완료`,
                fileCount: msg.payload.fileCount,
                error: null,
              });
              cleanup();
              break;
            case "upload-error":
              setState({
                phase: "failed",
                message: "",
                fileCount: null,
                error: msg.payload.error ?? "업로드 처리에 실패했습니다.",
              });
              cleanup();
              break;
          }
        } catch (e) {
          console.warn("[WS:upload] malformed message:", e);
        }
      };
    }

    const rws = createReconnectingWs(() => wsUrl, {
      maxRetries: 8,
      onStateChange: setConnectionState,
      onDisconnect() {
        seqTracker.reset();
      },
      async onReconnect() {
        // REST fallback: restore state from upload-status endpoint
        if (!projectId) return;
        try {
          const snapshot = await fetchUploadStatus(projectId, uploadId);
          setState((prev) => {
            if (prev.phase === "complete" || prev.phase === "failed") return prev;
            return {
              ...prev,
              phase: (snapshot.phase as UploadPhase) ?? prev.phase,
              message: PHASE_LABELS[snapshot.phase] ?? prev.message,
              fileCount: snapshot.fileCount ?? prev.fileCount,
            };
          });
        } catch (e) {
          // 404 = snapshot no longer available (non-permanent per WR)
          if (e instanceof ApiError && e.message.includes("404")) {
            setState((prev) => {
              if (prev.phase === "complete" || prev.phase === "failed") return prev;
              return { ...prev, message: "마지막 확인된 상태를 불러올 수 없습니다" };
            });
          } else {
            logError("Upload recovery", e);
          }
        }
        // Re-wire message handlers on new WS after reconnect
        wireWsHandlers(rws.getWs());
      },
      onGiveUp() {
        setState((prev) => {
          if (prev.phase === "complete" || prev.phase === "failed") return prev;
          return { ...prev, phase: "failed", error: "업로드 연결이 끊어졌습니다." };
        });
      },
    });
    rwsRef.current = rws;
    wireWsHandlers(rws.getWs());
  }, [cleanup]);

  const setUploading = useCallback(() => {
    setState({ phase: "uploading", message: "파일 전송 중...", fileCount: null, error: null });
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setState(INITIAL);
    setConnectionState("disconnected");
  }, [cleanup]);

  const isActive = state.phase !== "idle" && state.phase !== "complete" && state.phase !== "failed";

  return { ...state, connectionState, isActive, setUploading, startTracking, reset };
}
