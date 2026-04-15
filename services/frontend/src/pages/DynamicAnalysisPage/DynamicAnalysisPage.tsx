import React from "react";
import { useParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { DynamicAnalysisConfigView } from "./components/DynamicAnalysisConfigView";
import { DynamicAnalysisHistoryView } from "./components/DynamicAnalysisHistoryView";
import { MonitoringView } from "./components/MonitoringView";
import { SessionDetailView } from "./components/SessionDetailView";
import { useAdapters } from "../../hooks/useAdapters";
import { useDynamicAnalysisPage } from "./hooks/useDynamicAnalysisPage";
import "./DynamicAnalysisPage.css";

export const DynamicAnalysisPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connected, hasConnected } = useAdapters(projectId);
  const toast = useToast();
  const {
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
    reloadSessions,
  } = useDynamicAnalysisPage(projectId, toast, connected, hasConnected);

  if (activeSession) {
    return (
      <MonitoringView
        session={activeSession}
        onBack={() => {
          setActiveSession(null);
          reloadSessions();
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
          reloadSessions();
        }}
      />
    );
  }

  if (showSelector) {
    return (
      <DynamicAnalysisConfigView
        projectId={projectId}
        connected={connected}
        selectedAdapterId={selectedAdapterId}
        setSelectedAdapterId={setSelectedAdapterId}
        creating={creating}
        onBack={closeSelector}
        onStart={() => selectedAdapterId && handleCreateSession(selectedAdapterId)}
      />
    );
  }

  return <DynamicAnalysisHistoryView {...historyState} />;
};
