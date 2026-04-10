import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ProjectOverviewResponse, UploadedFile } from "@aegis/shared";
import { fetchProjectOverview, fetchProjectFiles, logError } from "../../api/client";
import { fetchProjectActivity } from "../../api/projects";
import type { ActivityEntry } from "../../api/projects";
import { fetchProjectSdks } from "../../api/sdk";
import type { RegisteredSdk } from "../../api/sdk";
import { fetchProjectGates } from "../../api/gate";
import type { GateResult } from "../../api/gate";
import { fetchApprovalCount } from "../../api/approval";
import { useBuildTargets } from "../../hooks/useBuildTargets";
import { useToast } from "../../contexts/ToastContext";
import { Spinner } from "../../shared/ui";
import { BuildTargetsSection } from "./components/BuildTargetsSection";
import { OverviewActivityPanel } from "./components/OverviewActivityPanel";
import { OverviewBottomGrid } from "./components/OverviewBottomGrid";
import { OverviewEmptyState } from "./components/OverviewEmptyState";
import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewMetaPanel } from "./components/OverviewMetaPanel";
import { SecurityPostureSection } from "./components/SecurityPostureSection";
import { TrendSummaryCard } from "./components/TrendSummaryCard";
import { getGateCounts, getTopVulnerabilities, getTotalFindings, isOverviewEmpty } from "./overviewModel";
import "./OverviewPage.css";

export const OverviewPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<ProjectOverviewResponse | null>(null);
  const [projectFiles, setProjectFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeredSdks, setRegisteredSdks] = useState<RegisteredSdk[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [gates, setGates] = useState<GateResult[]>([]);
  const [approvalCount, setApprovalCount] = useState<{ pending: number; total: number }>({ pending: 0, total: 0 });
  const toast = useToast();
  const buildTargets = useBuildTargets(projectId);

  useEffect(() => {
    document.title = "AEGIS — Overview";
  }, []);

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    Promise.all([
      fetchProjectOverview(projectId),
      fetchProjectFiles(projectId).catch(() => [] as UploadedFile[]),
    ])
      .then(([nextOverview, files]) => {
        setOverview(nextOverview);
        setProjectFiles(files);
      })
      .catch((error) => {
        logError("Fetch overview", error);
        toast.error("프로젝트 개요를 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));

    fetchProjectSdks(projectId)
      .then((data) => setRegisteredSdks(data.registered))
      .catch(() => setRegisteredSdks([]));

    fetchProjectActivity(projectId, 8)
      .then(setActivities)
      .catch(() => setActivities([]));

    fetchProjectGates(projectId)
      .then(setGates)
      .catch(() => setGates([]));

    fetchApprovalCount(projectId)
      .then(setApprovalCount)
      .catch(() => setApprovalCount({ pending: 0, total: 0 }));
  }, [projectId, toast]);

  const recentAnalyses = overview?.recentAnalyses ?? [];
  const topVulnerabilities = useMemo(() => getTopVulnerabilities(recentAnalyses, 8), [recentAnalyses]);
  const gateCounts = useMemo(() => getGateCounts(gates), [gates]);
  const totalFileSize = useMemo(
    () => projectFiles.reduce((size, file) => size + (file.size || 0), 0),
    [projectFiles],
  );

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="데이터 로딩 중..." />
      </div>
    );
  }

  if (!overview) {
    return <h2 className="page-title">데이터를 불러올 수 없습니다</h2>;
  }

  const { project, summary } = overview;
  const severitySummary = summary?.bySeverity ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const totalFindings = getTotalFindings(severitySummary);
  const empty = isOverviewEmpty(recentAnalyses, projectFiles);

  const openProjectPath = (path: string) => {
    if (!projectId) return;
    navigate(`/projects/${projectId}/${path}`);
  };

  return (
    <div className="page-enter">
      <OverviewHeader name={project.name} description={project.description} />

      {empty ? (
        <OverviewEmptyState
          onOpenFiles={() => openProjectPath("files")}
          onOpenSettings={() => openProjectPath("settings")}
        />
      ) : (
        <>
          <SecurityPostureSection
            severity={severitySummary}
            totalFindings={totalFindings}
            onOpenAllFindings={() => openProjectPath("vulnerabilities")}
            onOpenSeverity={(severity) => openProjectPath(`vulnerabilities?severity=${severity}`)}
          />

          <BuildTargetsSection targets={buildTargets.targets} onOpenFiles={() => openProjectPath("files")} />

          <TrendSummaryCard trend={overview.trend} />

          <div className="overview-main-grid">
            <OverviewActivityPanel activities={activities} />
            <OverviewMetaPanel
              fileCount={overview.fileCount ?? projectFiles.length}
              totalFileSize={totalFileSize}
              description={project.description}
              hasFiles={projectFiles.length > 0}
              hasGates={gates.length > 0}
              gateCounts={gateCounts}
              approvalCount={approvalCount}
              registeredSdks={registeredSdks}
              onOpenQualityGate={() => openProjectPath("quality-gate")}
              onOpenApprovals={() => openProjectPath("approvals")}
              onOpenSettings={() => openProjectPath("settings")}
            />
          </div>

          <OverviewBottomGrid
            projectFiles={projectFiles}
            totalFileSize={totalFileSize}
            topVulnerabilities={topVulnerabilities}
            totalVulnerabilities={summary?.totalVulnerabilities ?? 0}
            targets={buildTargets.targets}
            targetSummary={overview.targetSummary}
            onOpenFiles={() => openProjectPath("files")}
            onOpenFileDetail={(fileId) => openProjectPath(`files/${fileId}`)}
            onOpenVulnerabilities={() => openProjectPath("vulnerabilities")}
          />
        </>
      )}
    </div>
  );
};
