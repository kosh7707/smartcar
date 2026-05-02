import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStaticDashboard } from "@/common/hooks/useStaticDashboard";
import { useAnalysisWebSocket } from "@/common/hooks/useAnalysisWebSocket";
import { useBuildTargets } from "@/common/hooks/useBuildTargets";
import { useToast } from "@/common/contexts/ToastContext";
import { useSetAnalysisGuard } from "@/common/contexts/AnalysisGuardContext";
import { StaticAnalysisViewRouter } from "./components/StaticAnalysisViewRouter/StaticAnalysisViewRouter";
import { useStaticAnalysisPageController } from "./useStaticAnalysisPageController";
import "./StaticAnalysisPage.css";

export const StaticAnalysisPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const guard = useSetAnalysisGuard();
  const dashboard = useStaticDashboard(projectId);
  const analysis = useAnalysisWebSocket();
  const buildTargets = useBuildTargets(projectId);
  const state = useStaticAnalysisPageController(
    projectId,
    dashboard,
    analysis,
    buildTargets,
    toast,
    guard,
    navigate,
    searchParams.get("analysisId"),
    searchParams.get("finding"),
  );

  React.useEffect(() => {
    document.title = "AEGIS — 정적 분석";
  }, []);

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
