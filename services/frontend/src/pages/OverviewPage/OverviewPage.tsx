import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBuildTargets } from "../../hooks/useBuildTargets";
import { useToast } from "../../contexts/ToastContext";
import { Spinner } from "../../shared/ui";
import { BuildTargetsSection } from "./components/BuildTargetsSection";
import { OverviewActivityPanel } from "./components/OverviewActivityPanel";
import { OverviewBottomGrid } from "./components/OverviewBottomGrid";
import { OverviewEmptyState } from "./components/OverviewEmptyState";
import { OverviewFailureState } from "./components/OverviewFailureState";
import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewMetaPanel } from "./components/OverviewMetaPanel";
import { SecurityPostureSection } from "./components/SecurityPostureSection";
import { TrendSummaryCard } from "./components/TrendSummaryCard";
import { useOverviewPage } from "./hooks/useOverviewPage";

export const OverviewPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const buildTargets = useBuildTargets(projectId);
  const state = useOverviewPage(projectId, toast);

  if (state.loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="데이터 로딩 중..." />
      </div>
    );
  }

  if (!state.overview) return <OverviewFailureState />;

  const { project, summary } = state.overview;

  const openProjectPath = (path: string) => {
    state.openProjectPath(navigate, path);
  };

  return (
    <div className="page-enter flex flex-col gap-8">
      <OverviewHeader name={project.name} description={project.description} />

      {state.empty ? (
        <OverviewEmptyState
          onOpenFiles={() => openProjectPath("files")}
          onOpenSettings={() => openProjectPath("settings")}
        />
      ) : (
        <>
          <SecurityPostureSection
            severity={state.severitySummary}
            totalFindings={state.totalFindings}
            onOpenAllFindings={() => openProjectPath("vulnerabilities")}
            onOpenSeverity={(severity) => openProjectPath(`vulnerabilities?severity=${severity}`)}
          />

          <BuildTargetsSection targets={buildTargets.targets} onOpenFiles={() => openProjectPath("files")} />

          <TrendSummaryCard trend={state.overview.trend} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <OverviewActivityPanel activities={state.activities} />
            <OverviewMetaPanel
              fileCount={state.overview.fileCount ?? state.projectFiles.length}
              totalFileSize={state.totalFileSize}
              description={project.description}
              hasFiles={state.projectFiles.length > 0}
              hasGates={state.gates.length > 0}
              gateCounts={state.gateCounts}
              approvalCount={state.approvalCount}
              registeredSdks={state.registeredSdks}
              onOpenQualityGate={() => openProjectPath("quality-gate")}
              onOpenApprovals={() => openProjectPath("approvals")}
              onOpenSettings={() => openProjectPath("settings")}
            />
          </div>

          <OverviewBottomGrid
            projectFiles={state.projectFiles}
            totalFileSize={state.totalFileSize}
            topVulnerabilities={state.topVulnerabilities}
            totalVulnerabilities={summary?.totalVulnerabilities ?? 0}
            targets={buildTargets.targets}
            targetSummary={state.overview.targetSummary}
            onOpenFiles={() => openProjectPath("files")}
            onOpenFileDetail={(fileId) => openProjectPath(`files/${fileId}`)}
            onOpenVulnerabilities={() => openProjectPath("vulnerabilities")}
          />
        </>
      )}
    </div>
  );
};
