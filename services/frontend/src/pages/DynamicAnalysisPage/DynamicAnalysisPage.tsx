import React, { useEffect, useState, useCallback } from "react";
import "../../shared/analysis/AnalysisListItem.css";
import { useParams } from "react-router-dom";
import type { DynamicAnalysisSession } from "@aegis/shared";
import {
  createDynamicSession,
  fetchDynamicSessions,
  startDynamicSession,
  stopDynamicSession,
  ApiError,
  logError,
} from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { DynamicAnalysisConfigView } from "./components/DynamicAnalysisConfigView";
import { DynamicAnalysisHistoryView } from "./components/DynamicAnalysisHistoryView";
import { MonitoringView } from "./components/MonitoringView";
import { SessionDetailView } from "./components/SessionDetailView";
import { useAdapters } from "../../hooks/useAdapters";
import "./DynamicAnalysisPage.css";

export const DynamicAnalysisPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  useEffect(() => {
    document.title = "AEGIS — Dynamic Analysis";
  }, []);

  const { connected, hasConnected } = useAdapters(projectId);
  const toast = useToast();
  const [sessions, setSessions] = useState<DynamicAnalysisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [adapterWarning, setAdapterWarning] = useState(false);
  const [selectedAdapterId, setSelectedAdapterId] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);

  // View state
  const [activeSession, setActiveSession] = useState<DynamicAnalysisSession | null>(null);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    if (!projectId) return;
    fetchDynamicSessions(projectId)
      .then(setSessions)
      .catch((e) => {
        logError("Load sessions", e);
        const retry = e instanceof ApiError && e.retryable ? { label: "다시 시도", onClick: loadSessions } : undefined;
        toast.error(e instanceof Error ? e.message : "세션 목록을 불러올 수 없습니다.", retry);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Check if there's already an active (monitoring) session
  useEffect(() => {
    const monitoring = sessions.find((s) => s.status === "monitoring");
    if (monitoring) {
      setActiveSession(monitoring);
    }
  }, [sessions]);

  const handleCreateSession = async (adapterId: string) => {
    if (!projectId) return;
    setCreating(true);
    try {
      const session = await createDynamicSession(projectId, adapterId);
      const started = await startDynamicSession(session.id);
      setActiveSession(started);
    } catch (e) {
      logError("Create session", e);
      const retry = e instanceof ApiError && e.retryable ? { label: "다시 시도", onClick: () => handleCreateSession(adapterId) } : undefined;
      toast.error(e instanceof Error ? e.message : "세션 생성에 실패했습니다.", retry);
    } finally {
      setCreating(false);
      setShowSelector(false);
      setSelectedAdapterId(null);
    }
  };

  const handleNewSessionClick = () => {
    if (!hasConnected) {
      setAdapterWarning(true);
      return;
    }
    setAdapterWarning(false);
    setShowSelector(true);
    if (connected.length === 1) {
      setSelectedAdapterId(connected[0].id);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      await stopDynamicSession(sessionId);
    } catch (e) {
      logError("Stop session", e);
      toast.error("세션 종료에 실패했습니다.");
    }
  };

  const handleSessionStopped = () => {
    setActiveSession(null);
    loadSessions();
  };

  const handleSessionClick = (session: DynamicAnalysisSession) => {
    if (session.status === "monitoring") {
      setActiveSession(session);
    } else {
      setViewingSessionId(session.id);
    }
  };

  // Active monitoring view
  if (activeSession) {
    return (
      <MonitoringView
        session={activeSession}
        onBack={() => {
          setActiveSession(null);
          loadSessions();
        }}
        onStopped={handleSessionStopped}
      />
    );
  }

  // Session detail view
  if (viewingSessionId) {
    return (
      <SessionDetailView
        sessionId={viewingSessionId}
        onBack={() => {
          setViewingSessionId(null);
          loadSessions();
        }}
      />
    );
  }

  // New session config view
  if (showSelector) {
    return (
      <DynamicAnalysisConfigView
        projectId={projectId}
        connected={connected}
        selectedAdapterId={selectedAdapterId}
        setSelectedAdapterId={setSelectedAdapterId}
        creating={creating}
        onBack={() => { setShowSelector(false); setSelectedAdapterId(null); }}
        onStart={() => selectedAdapterId && handleCreateSession(selectedAdapterId)}
      />
    );
  }

  // Default: session history
  return (
    <DynamicAnalysisHistoryView
      projectId={projectId}
      connectionState={hasConnected ? "connected" : "disconnected"}
      hasConnected={hasConnected}
      creating={creating}
      adapterWarning={adapterWarning}
      setAdapterWarning={setAdapterWarning}
      historyLoading={loading}
      sessions={sessions}
      confirmStopId={confirmStopId}
      setConfirmStopId={setConfirmStopId}
      onOpenConfig={handleNewSessionClick}
      onOpenSession={handleSessionClick}
      onConfirmStop={(sessionId) => handleStopSession(sessionId).then(loadSessions)}
    />
  );
};
