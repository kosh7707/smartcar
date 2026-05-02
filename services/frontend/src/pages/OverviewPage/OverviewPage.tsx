import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBuildTargets } from "@/common/hooks/useBuildTargets";
import { useToast } from "@/common/contexts/ToastContext";
import { Spinner } from "@/common/ui/primitives";
import { BuildTargetsSection } from "./components/BuildTargetsSection/BuildTargetsSection";
import { OverviewActivityPanel } from "./components/OverviewActivityPanel/OverviewActivityPanel";
import { OverviewBottomGrid } from "./components/OverviewBottomGrid/OverviewBottomGrid";
import { OverviewEmptyState } from "./components/OverviewEmptyState/OverviewEmptyState";
import { OverviewFailureState } from "./components/OverviewFailureState/OverviewFailureState";
import { OverviewHeader } from "./components/OverviewHeader/OverviewHeader";
import { OverviewMetaPanel } from "./components/OverviewMetaPanel/OverviewMetaPanel";
import { SecurityPostureSection } from "./components/SecurityPostureSection/SecurityPostureSection";
import { TrendSummaryCard } from "./components/TrendSummaryCard/TrendSummaryCard";
import { useOverviewPageController } from "./useOverviewPageController";
import "./OverviewPage.css";

function toShortDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

function toRelative(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const min = Math.round(diffMs / 60000);
    if (min < 1) return "방금";
    if (min < 60) return `${min}분 전`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}일 전`;
    return toShortDate(iso);
  } catch {
    return "—";
  }
}

export const OverviewPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const buildTargets = useBuildTargets(projectId);
  const state = useOverviewPageController(projectId, toast);

  if (state.loading) {
    return (
      <div className="page-loading-shell">
        <Spinner size={36} label="데이터 로딩 중..." />
      </div>
    );
  }

  if (!state.overview) return <OverviewFailureState />;

  const { project, summary } = state.overview;

  const openProjectPath = (path: string) => {
    state.openProjectPath(navigate, path);
  };

  const lastScanIso = state.recentAnalyses[0]?.createdAt;
  const gateTotal = state.gateCounts.pass + state.gateCounts.fail + state.gateCounts.warning;
  const findingsTone: "critical" | "warn" | "ok" =
    (state.severitySummary.critical ?? 0) > 0 ? "critical"
    : (state.severitySummary.high ?? 0) > 0 ? "warn"
    : state.totalFindings > 0 ? "warn"
    : "ok";

  const identityStats = [
    { label: "Created", value: toShortDate(project.createdAt) },
    { label: "Last scan", value: toRelative(lastScanIso), tone: lastScanIso ? "info" as const : "neutral" as const },
    { label: "Targets", value: String(buildTargets.targets.length) },
    { label: "Findings", value: String(state.totalFindings), tone: findingsTone },
    { label: "Gate", value: gateTotal === 0 ? "—" : `${state.gateCounts.pass}/${gateTotal}`, tone: state.gateCounts.fail > 0 ? "critical" as const : state.gateCounts.pass > 0 ? "ok" as const : "neutral" as const },
  ];

  return (
    <div className="page-shell">
      <OverviewHeader name={project.name} description={project.description} stats={identityStats} />

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
            deepResult={state.latestDeepResult}
          />

          <BuildTargetsSection targets={buildTargets.targets} onOpenFiles={() => openProjectPath("files")} />

          <TrendSummaryCard trend={state.overview.trend} />

          <div className="overview-main-grid">
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
