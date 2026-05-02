import { useCallback, useEffect, useMemo, useState } from "react";
import type { DynamicAnalysisSession } from "@aegis/shared";
import {
  ApiError,
  createDynamicSession,
  fetchDynamicSessions,
  logError,
  startDynamicSession,
  stopDynamicSession,
} from "@/common/api/client";
import type { ConnectionState } from "@/common/utils/wsEnvelope";

type ToastAction = { label: string; onClick: () => void } | undefined;

type ToastApi = {
  error: (message: string, action?: ToastAction) => void;
};

type AdapterSummary = { id: string };

export function useDynamicAnalysisPageController(
  projectId: string | undefined,
  toast: ToastApi,
  connected: AdapterSummary[],
  hasConnected: boolean,
) {
  const [sessions, setSessions] = useState<DynamicAnalysisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [adapterWarning, setAdapterWarning] = useState(false);
  const [selectedAdapterId, setSelectedAdapterId] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [activeSession, setActiveSession] = useState<DynamicAnalysisSession | null>(null);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "AEGIS — Dynamic Analysis";
  }, []);

  const loadSessions = useCallback(() => {
    if (!projectId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    fetchDynamicSessions(projectId)
      .then(setSessions)
      .catch((error) => {
        logError("Load sessions", error);
        const retry = error instanceof ApiError && error.retryable ? { label: "다시 시도", onClick: loadSessions } : undefined;
        toast.error(error instanceof Error ? error.message : "세션 목록을 불러올 수 없습니다.", retry);
      })
      .finally(() => setLoading(false));
  }, [projectId, toast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const monitoring = sessions.find((session) => session.status === "monitoring");
    if (monitoring) {
      setActiveSession(monitoring);
    }
  }, [sessions]);

  const closeSelector = useCallback(() => {
    setShowSelector(false);
    setSelectedAdapterId(null);
  }, []);

  const handleCreateSession = useCallback(async (adapterId: string) => {
    if (!projectId) return;
    setCreating(true);
    try {
      const session = await createDynamicSession(projectId, adapterId);
      const started = await startDynamicSession(session.id);
      setActiveSession(started);
    } catch (error) {
      logError("Create session", error);
      const retry = error instanceof ApiError && error.retryable ? { label: "다시 시도", onClick: () => handleCreateSession(adapterId) } : undefined;
      toast.error(error instanceof Error ? error.message : "세션 생성에 실패했습니다.", retry);
    } finally {
      setCreating(false);
      closeSelector();
    }
  }, [closeSelector, projectId, toast]);

  const openConfig = useCallback(() => {
    if (!hasConnected) {
      setAdapterWarning(true);
      return;
    }

    setAdapterWarning(false);
    setShowSelector(true);
    if (connected.length === 1) {
      setSelectedAdapterId(connected[0].id);
    }
  }, [connected, hasConnected]);

  const handleStopSession = useCallback(async (sessionId: string) => {
    try {
      await stopDynamicSession(sessionId);
    } catch (error) {
      logError("Stop session", error);
      toast.error("세션 종료에 실패했습니다.");
    }
  }, [toast]);

  const handleSessionStopped = useCallback(() => {
    setActiveSession(null);
    loadSessions();
  }, [loadSessions]);

  const handleSessionClick = useCallback((session: DynamicAnalysisSession) => {
    if (session.status === "monitoring") {
      setActiveSession(session);
      return;
    }

    setViewingSessionId(session.id);
  }, []);

  const historyState = useMemo(() => ({
    projectId,
    connectionState: (hasConnected ? "connected" : "disconnected") as ConnectionState,
    hasConnected,
    creating,
    adapterWarning,
    setAdapterWarning,
    historyLoading: loading,
    sessions,
    confirmStopId,
    setConfirmStopId,
    onOpenConfig: openConfig,
    onOpenSession: handleSessionClick,
    onConfirmStop: (sessionId: string) => handleStopSession(sessionId).then(loadSessions),
  }), [
    adapterWarning,
    confirmStopId,
    creating,
    handleSessionClick,
    handleStopSession,
    hasConnected,
    loadSessions,
    loading,
    openConfig,
    projectId,
    sessions,
  ]);

  return {
    selectedAdapterId,
    setSelectedAdapterId,
    activeSession,
    setActiveSession,
    viewingSessionId,
    setViewingSessionId,
    showSelector,
    creating,
    historyState,
    closeSelector,
    handleCreateSession,
    handleSessionStopped,
    reloadSessions: loadSessions,
  };
}
