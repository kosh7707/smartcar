import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStaticDashboard } from "../../hooks/useStaticDashboard";
import { useAnalysisWebSocket } from "../../hooks/useAnalysisWebSocket";
import { useBuildTargets } from "../../hooks/useBuildTargets";
import { useToast } from "../../contexts/ToastContext";
import { useSetAnalysisGuard } from "../../contexts/AnalysisGuardContext";
import { StaticAnalysisViewRouter } from "./components/StaticAnalysisViewRouter";
import { useStaticAnalysisPage } from "./hooks/useStaticAnalysisPage";
import "./StaticAnalysisPage.css";

export const StaticAnalysisPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const guard = useSetAnalysisGuard();
  const dashboard = useStaticDashboard(projectId);
  const analysis = useAnalysisWebSocket();
  const buildTargets = useBuildTargets(projectId);
  const state = useStaticAnalysisPage(projectId, dashboard, analysis, buildTargets, toast, guard, navigate);

  if (!projectId) return null;
  return (
    <StaticAnalysisViewRouter
      projectId={projectId}
      dashboard={dashboard as never}
      analysis={analysis}
      buildTargets={buildTargets as never}
      state={state as never}
    />
  );
};
