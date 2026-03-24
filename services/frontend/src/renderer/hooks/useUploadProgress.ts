import { useState, useCallback, useRef, useEffect } from "react";
import { getWsBaseUrl, logError } from "../api/client";

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

export function useUploadProgress() {
  const [state, setState] = useState<UploadProgressState>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startTracking = useCallback((uploadId: string) => {
    cleanup();
    setState({ phase: "received", message: "서버 처리 중...", fileCount: null, error: null });

    const wsUrl = `${getWsBaseUrl()}/ws/upload?uploadId=${encodeURIComponent(uploadId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
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

    ws.onerror = () => {
      console.warn("[WS:upload] connection error");
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      setState((prev) => {
        if (prev.phase === "complete" || prev.phase === "failed" || prev.phase === "idle") return prev;
        return { ...prev, phase: "failed", error: "업로드 연결이 끊어졌습니다." };
      });
    };
  }, [cleanup]);

  const setUploading = useCallback(() => {
    setState({ phase: "uploading", message: "파일 전송 중...", fileCount: null, error: null });
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setState(INITIAL);
  }, [cleanup]);

  const isActive = state.phase !== "idle" && state.phase !== "complete" && state.phase !== "failed";

  return { ...state, isActive, setUploading, startTracking, reset };
}
