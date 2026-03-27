import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { ProjectOverviewResponse, AnalysisResult, AnalysisSummary, UploadedFile, Vulnerability } from "@aegis/shared";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  FileText,
  LayoutDashboard,
  ChevronRight,
  Shield,
  HardDrive,
  Settings,
  Activity,
} from "lucide-react";
import { fetchProjectOverview, fetchProjectFiles, logError } from "../api/client";
import { fetchProjectActivity } from "../api/projects";
import type { ActivityEntry } from "../api/projects";
import { fetchProjectSdks } from "../api/sdk";
import type { RegisteredSdk } from "../api/sdk";
import { useBuildTargets } from "../hooks/useBuildTargets";
import { useToast } from "../contexts/ToastContext";
import { PageHeader, StatCard, SeveritySummary, SeverityBadge, DonutChart, Spinner, TargetStatusBadge } from "../components/ui";
import { SEVERITY_ORDER } from "../utils/severity";
import { formatFileSize, formatDateTime } from "../utils/format";
import { MODULE_META, MODULE_LABELS } from "../constants/modules";
import { LANG_COLORS, getLangColor } from "../constants/languages";
import "./OverviewPage.css";

function getTopVulnerabilities(analyses: AnalysisResult[], count = 5): Vulnerability[] {
  const all: Vulnerability[] = [];
  for (const a of analyses) {
    if (a.status !== "completed") continue;
    all.push(...a.vulnerabilities);
  }
  return all
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, count);
}

function getLatestPerModule(analyses: AnalysisResult[]): Map<string, AnalysisResult> {
  const map = new Map<string, AnalysisResult>();
  for (const a of analyses) {
    if (a.status !== "completed") continue;
    if (!map.has(a.module)) map.set(a.module, a);
  }
  return map;
}

function getLangBreakdown(files: UploadedFile[]): React.ReactNode {
  if (files.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const f of files) {
    const lang = f.language || "other";
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <span className="stat-card__breakdown">
      {entries.map(([lang, count], i) => (
        <React.Fragment key={lang}>
          {i > 0 && <span className="stat-card__sep" />}
          <span className="stat-card__module stat-card__module--active">
            <span className="stat-card__lang-dot" style={{ background: LANG_COLORS[lang] || "var(--text-tertiary)" }} />
            {lang} <span className="stat-card__module-count">{count}</span>
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

function getModuleBreakdown(
  latestMap: Map<string, AnalysisResult>,
  severity: keyof AnalysisSummary,
): React.ReactNode {
  return (
    <span className="stat-card__breakdown">
      {MODULE_LABELS.map(({ key, label }, i) => {
        const count = latestMap.get(key)?.summary[severity] ?? 0;
        return (
          <React.Fragment key={key}>
            {i > 0 && <span className="stat-card__sep" />}
            <span className={`stat-card__module${count > 0 ? " stat-card__module--active" : ""}`}>
              {label} <span className="stat-card__module-count">{count}</span>
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

export const OverviewPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<ProjectOverviewResponse | null>(null);
  const [projectFiles, setProjectFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeredSdks, setRegisteredSdks] = useState<RegisteredSdk[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const toast = useToast();
  const bt = useBuildTargets(projectId);

  const loadData = () => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      fetchProjectOverview(projectId),
      fetchProjectFiles(projectId).catch(() => [] as UploadedFile[]),
    ])
      .then(([ov, files]) => {
        setOverview(ov);
        setProjectFiles(files);
      })
      .catch((e) => { logError("Fetch overview", e); toast.error("프로젝트 개요를 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    if (projectId) {
      fetchProjectSdks(projectId)
        .then((data) => setRegisteredSdks(data.registered))
        .catch(() => setRegisteredSdks([]));
      fetchProjectActivity(projectId, 8)
        .then(setActivities)
        .catch(() => setActivities([]));
    }
  }, [projectId]);

  const recentAnalyses = overview?.recentAnalyses ?? [];
  const latestMap = useMemo(() => getLatestPerModule(recentAnalyses), [recentAnalyses]);
  const topVulns = useMemo(() => getTopVulnerabilities(recentAnalyses, 8), [recentAnalyses]);

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
  const sev = summary.bySeverity;

  return (
    <div className="page-enter">
      <PageHeader
        title={project.name}
        icon={<LayoutDashboard size={20} />}
        subtitle={project.description || undefined}
      />

      {/* Security overview: Donut + module rows */}
      <div className="card">
        <div className="overview-security-card">
          <DonutChart summary={sev} size={140} showLegend={false} />
          <div className="overview-module-rows">
            {Object.entries(MODULE_META).map(([key, meta]) => {
              const latest = latestMap.get(key);
              return (
                <div
                  key={key}
                  className="overview-module-row"
                  onClick={() => navigate(`/projects/${projectId}/${meta.path}`)}
                >
                  <span className="overview-module-row__icon">{meta.icon}</span>
                  <span className="overview-module-row__name">{meta.label}</span>
                  {latest ? (
                    <>
                      <SeveritySummary summary={latest.summary} />
                      <span className="overview-module-row__time">
                        {formatDateTime(latest.createdAt)}
                      </span>
                    </>
                  ) : (
                    <span className="overview-module-row__empty">미실행</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-cards stagger">
        <StatCard icon={<FileText size={16} />} label="파일 수" value={overview.fileCount ?? projectFiles.length} accent detail={getLangBreakdown(projectFiles)} onClick={() => navigate(`/projects/${projectId}/files`)} />
        <StatCard icon={<AlertTriangle size={16} />} label="Critical" value={sev.critical} color="var(--severity-critical)" detail={getModuleBreakdown(latestMap, "critical")} onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=critical`)} />
        <StatCard icon={<AlertTriangle size={16} />} label="High" value={sev.high} color="var(--severity-high)" detail={getModuleBreakdown(latestMap, "high")} onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=high`)} />
        <StatCard icon={<AlertCircle size={16} />} label="Medium" value={sev.medium} color="var(--severity-medium)" detail={getModuleBreakdown(latestMap, "medium")} onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=medium`)} />
        <StatCard icon={<Info size={16} />} label="Low" value={sev.low} color="var(--severity-low)" detail={getModuleBreakdown(latestMap, "low")} onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=low`)} />
      </div>

      {/* Bottom grid: Files + History */}
      <div className="overview-bottom-grid">
        {/* Files */}
        <div className="card overview-files-card">
          <div
            className="card-title overview-file-header"
            onClick={() => navigate(`/projects/${projectId}/files`)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <FileText size={16} />
              업로드된 파일 ({projectFiles.length}){projectFiles.length > 0 && <span className="overview-file-total-size">· {formatFileSize(projectFiles.reduce((sum, f) => sum + (f.size || 0), 0))}</span>}
            </span>
            <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
          </div>
          {projectFiles.length === 0 ? (
            <p className="overview-empty-text">아직 업로드된 파일이 없습니다.</p>
          ) : (
            <div className={`overview-files-body${projectFiles.length >= 5 ? " has-fade" : ""}`}>
              {projectFiles.slice(0, 8).map((file) => (
                <div
                  key={file.id}
                  className="overview-file-row overview-file-row--clickable"
                  onClick={() => navigate(`/projects/${projectId}/files/${file.id}`)}
                >
                  <FileText size={14} style={{ color: getLangColor(file), flexShrink: 0 }} />
                  <div className="overview-file-info">
                    <span className="overview-file-name">{file.name}</span>
                    {file.path && file.path !== file.name && (
                      <span className="overview-file-path">{file.path.slice(0, file.path.lastIndexOf("/"))}/</span>
                    )}
                  </div>
                  {file.language && <span className="overview-lang-tag">{file.language}</span>}
                  <span className="overview-file-size">{formatFileSize(file.size)}</span>
                </div>
              ))}
              {projectFiles.length >= 5 && (
                <div className="overview-card-fade" onClick={() => navigate(`/projects/${projectId}/files`)}>
                  <span>전체 보기 →</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top vulnerabilities */}
        <div className="card overview-vuln-card">
          <div
            className="card-title overview-vuln-header"
            onClick={() => navigate(`/projects/${projectId}/vulnerabilities`)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Shield size={16} />
              주요 취약점
            </span>
            <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
          </div>
          {topVulns.length === 0 ? (
            <p className="overview-empty-text">발견된 취약점이 없습니다.</p>
          ) : (
            <div className={`overview-vuln-body${summary.totalVulnerabilities >= 5 ? " has-fade" : ""}`}>
              {topVulns.map((v) => (
                <div
                  key={v.id}
                  className="overview-vuln-row"
                  onClick={() => navigate(`/projects/${projectId}/vulnerabilities`)}
                >
                  <SeverityBadge severity={v.severity} size="sm" />
                  <div className="overview-vuln-info">
                    <span className="overview-vuln-title">{v.title}</span>
                    {v.location && (
                      <span className="overview-vuln-location">{v.location}</span>
                    )}
                  </div>
                </div>
              ))}
              {summary.totalVulnerabilities >= 5 && (
                <div className="overview-card-fade" onClick={() => navigate(`/projects/${projectId}/vulnerabilities`)}>
                  <span>전체 보기 →</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subprojects */}
        <div className="card overview-subproject-card">
          <div
            className="card-title overview-subproject-header"
            onClick={() => navigate(`/projects/${projectId}/files`)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <HardDrive size={16} />
              서브 프로젝트 ({bt.targets.length}개)
            </span>
            <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
          </div>
          {bt.targets.length === 0 ? (
            <p className="overview-empty-text">등록된 서브 프로젝트가 없습니다.</p>
          ) : (
            <div className="overview-subproject-body">
              {bt.targets.map((t) => (
                <div key={t.id} className="overview-subproject-row">
                  <span className="overview-subproject-name">{t.name}</span>
                  <TargetStatusBadge status={t.status ?? "discovered"} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SDK */}
        <div className="card overview-sdk-card">
          <div
            className="card-title overview-sdk-header"
            onClick={() => navigate(`/projects/${projectId}/settings`)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Settings size={16} />
              SDK ({registeredSdks.length}개)
            </span>
            <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
          </div>
          {registeredSdks.length === 0 ? (
            <p className="overview-empty-text">등록된 SDK가 없습니다.</p>
          ) : (
            <div className="overview-sdk-body">
              {registeredSdks.map((sdk) => (
                <div key={sdk.id} className="overview-sdk-row">
                  <span className="overview-sdk-name">{sdk.name}</span>
                  <span className="overview-sdk-status" style={{
                    color: sdk.status === "ready" ? "var(--success)" : sdk.status === "verify_failed" ? "var(--danger)" : "var(--severity-medium)",
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--weight-medium)",
                  }}>
                    {sdk.status === "ready" ? "사용 가능" : sdk.status === "verify_failed" ? "검증 실패" : "진행 중"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="card overview-history-card">
          <div className="card-title overview-history-header">
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Activity size={16} />
              최근 활동
            </span>
          </div>
          {activities.length === 0 ? (
            <p className="overview-empty-text">아직 활동 이력이 없습니다.</p>
          ) : (
            <div className={`overview-history-body${activities.length >= 5 ? " has-fade" : ""}`}>
              {activities.map((a, i) => (
                <div key={i} className="overview-activity-row">
                  <span className="overview-activity-summary">{a.summary}</span>
                  <span className="overview-history-time">{formatDateTime(a.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
