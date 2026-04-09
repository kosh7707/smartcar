import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { ProjectOverviewResponse, AnalysisResult, AnalysisSummary, UploadedFile, Vulnerability } from "@aegis/shared";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  FileText,
  ChevronRight,
  Shield,
  HardDrive,
  Settings,
  Activity,
  CheckCircle2,
  Loader,
  XCircle,
  Search,
  ShieldCheck,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { fetchProjectOverview, fetchProjectFiles, logError } from "../api/client";
import { fetchProjectActivity } from "../api/projects";
import type { ActivityEntry } from "../api/projects";
import { fetchProjectSdks } from "../api/sdk";
import type { RegisteredSdk } from "../api/sdk";
import { fetchProjectGates } from "../api/gate";
import type { GateResult } from "../api/gate";
import { fetchApprovalCount } from "../api/approval";
import { useBuildTargets } from "../hooks/useBuildTargets";
import { useToast } from "../contexts/ToastContext";
import { SeverityBadge, Spinner, TargetStatusBadge } from "../components/ui";
import { SEVERITY_ORDER } from "../utils/severity";
import { formatFileSize, formatDateTime } from "../utils/format";
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
  const bt = useBuildTargets(projectId);

  useEffect(() => {
    document.title = "AEGIS — Overview";
  }, []);

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
      fetchProjectGates(projectId)
        .then(setGates)
        .catch(() => setGates([]));
      fetchApprovalCount(projectId)
        .then(setApprovalCount)
        .catch(() => setApprovalCount({ pending: 0, total: 0 }));
    }
  }, [projectId]);

  const recentAnalyses = overview?.recentAnalyses ?? [];
  const topVulns = useMemo(() => getTopVulnerabilities(recentAnalyses, 8), [recentAnalyses]);
  const gateCounts = useMemo(() => {
    const c = { pass: 0, fail: 0, warning: 0 };
    for (const g of gates) c[g.status]++;
    return c;
  }, [gates]);

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
  const sev = summary?.bySeverity ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const totalFindings = (sev.critical ?? 0) + (sev.high ?? 0) + (sev.medium ?? 0) + (sev.low ?? 0);
  const hasAnalysis = recentAnalyses.length > 0;
  const hasFiles = projectFiles.length > 0;
  const isEmpty = !hasAnalysis && !hasFiles;

  return (
    <div className="page-enter">
      {/* Page Header — v6 large title + subtitle */}
      <div className="overview-page-header">
        <div className="overview-page-header__info">
          <h1 className="overview-page-header__title">{project.name}</h1>
          {project.description && (
            <span className="overview-page-header__subtitle">{project.description}</span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="card overview-empty-hero">
          <div className="overview-empty-hero__icon">
            <Shield size={48} />
          </div>
          <h2 className="overview-empty-hero__title">분석 준비 완료</h2>
          <p className="overview-empty-hero__desc">
            소스 파일을 업로드하고 정적 분석을 실행하면 보안 대시보드가 활성화됩니다.
          </p>
          <div className="overview-empty-hero__actions">
            <button className="btn" onClick={() => navigate(`/projects/${projectId}/files`)}>
              <FileText size={14} /> 파일 업로드
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/projects/${projectId}/settings`)}>
              <Settings size={14} /> 프로젝트 설정
            </button>
          </div>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* Security Posture section */}
          <div style={{ marginBottom: "var(--cds-spacing-08)" }}>
            <div className="overview-section-header">
              <span className="overview-section-header__title">Security Posture</span>
              <span className="overview-section-header__line" />
            </div>
            <div className="overview-posture-grid">
              {/* Total findings */}
              <div
                className="overview-stat-card overview-stat-card--total"
                onClick={() => navigate(`/projects/${projectId}/vulnerabilities`)}
              >
                <span className="overview-stat-card__label">Total Findings</span>
                <span className="overview-stat-card__value">{totalFindings}</span>
              </div>
              {/* Critical */}
              <div
                className="overview-stat-card overview-stat-card--severity overview-stat-card--critical"
                onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=critical`)}
              >
                <span className="overview-stat-card__label overview-stat-card__label--critical">Critical</span>
                <span className="overview-stat-card__value">{sev.critical ?? 0}</span>
              </div>
              {/* High */}
              <div
                className="overview-stat-card overview-stat-card--severity overview-stat-card--high"
                onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=high`)}
              >
                <span className="overview-stat-card__label overview-stat-card__label--high">High</span>
                <span className="overview-stat-card__value">{sev.high ?? 0}</span>
              </div>
              {/* Medium */}
              <div
                className="overview-stat-card overview-stat-card--severity overview-stat-card--medium"
                onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=medium`)}
              >
                <span className="overview-stat-card__label overview-stat-card__label--medium">Medium</span>
                <span className="overview-stat-card__value">{sev.medium ?? 0}</span>
              </div>
              {/* Low */}
              <div
                className="overview-stat-card overview-stat-card--severity overview-stat-card--low"
                onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=low`)}
              >
                <span className="overview-stat-card__label overview-stat-card__label--low">Low</span>
                <span className="overview-stat-card__value">{sev.low ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Build Targets section */}
          {bt.targets.length > 0 && (
            <div style={{ marginBottom: "var(--cds-spacing-08)" }}>
              <div className="overview-section-header">
                <span className="overview-section-header__title">Build Targets</span>
                <span className="overview-section-header__line" />
              </div>
              <div className="overview-targets-grid">
                {bt.targets.map((t) => (
                  <div
                    key={t.id}
                    className="overview-target-card"
                    onClick={() => navigate(`/projects/${projectId}/files`)}
                  >
                    <span className="overview-target-card__name">{t.name}</span>
                    <div className="overview-target-card__footer">
                      <div>
                        <span className="overview-target-card__count-label">Findings</span>
                        <span className="overview-target-card__count-value">—</span>
                      </div>
                      <TargetStatusBadge status={t.status ?? "discovered"} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend */}
          {overview.trend && (overview.trend.newFindings > 0 || overview.trend.resolvedFindings > 0 || overview.trend.unresolvedTotal > 0) && (
            <div className="card overview-trend-card">
              <div className="card-title flex-center flex-gap-2">
                <Activity size={16} />
                이전 분석 대비 변화
              </div>
              <div className="overview-trend-row">
                <div className="overview-trend-item overview-trend-item--new">
                  <TrendingUp size={16} />
                  <span className="overview-trend-value">+{overview.trend.newFindings}</span>
                  <span className="overview-trend-label">신규 발견</span>
                </div>
                <div className="overview-trend-item overview-trend-item--resolved">
                  <TrendingDown size={16} />
                  <span className="overview-trend-value">-{overview.trend.resolvedFindings}</span>
                  <span className="overview-trend-label">해결됨</span>
                </div>
                <div className="overview-trend-item overview-trend-item--total">
                  <Minus size={16} />
                  <span className="overview-trend-value">{overview.trend.unresolvedTotal}</span>
                  <span className="overview-trend-label">미해결 총계</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity + Meta panel — 2-column layout */}
          <div className="overview-main-grid">
            {/* Left: Recent Activity */}
            <div>
              <div className="overview-section-header">
                <span className="overview-section-header__title">Recent Activity</span>
                <span className="overview-section-header__line" />
              </div>
              <div className="overview-activity-list">
                {activities.length === 0 ? (
                  <div style={{ padding: "var(--cds-spacing-05) var(--cds-spacing-06)" }}>
                    <p className="overview-empty-text">아직 활동 이력이 없습니다.</p>
                  </div>
                ) : (
                  activities.map((a, i) => (
                    <div key={i} className="overview-activity-item">
                      <div className="overview-activity-item__left">
                        <div className="overview-activity-icon">
                          <Activity size={14} />
                        </div>
                        <span className="overview-activity-item__summary">{a.summary}</span>
                      </div>
                      <span className="overview-activity-item__time">{formatDateTime(a.timestamp)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Meta panel */}
            <div className="overview-meta-panel">
              {/* Project Metadata */}
              <div className="overview-meta-section">
                <div className="overview-meta-section__title">Project Metadata</div>
                <div className="overview-meta-rows">
                  <div>
                    <span className="overview-meta-row__label">Files</span>
                    <span className="overview-meta-row__value">{overview.fileCount ?? projectFiles.length}</span>
                  </div>
                  {projectFiles.length > 0 && (
                    <div>
                      <span className="overview-meta-row__label">Total Size</span>
                      <span className="overview-meta-row__value">{formatFileSize(projectFiles.reduce((s, f) => s + (f.size || 0), 0))}</span>
                    </div>
                  )}
                  {project.description && (
                    <div>
                      <span className="overview-meta-row__label">Description</span>
                      <span className="overview-meta-row__value" style={{ fontFamily: "inherit", fontSize: "var(--cds-type-sm)" }}>{project.description}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quality Gate */}
              {gates.length > 0 && (
                <div
                  className="overview-meta-section"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/projects/${projectId}/quality-gate`)}
                >
                  <div className="overview-meta-section__title">Quality Gate</div>
                  <div className="overview-gate-summary">
                    <span className="overview-gate-item overview-gate-item--pass">
                      <CheckCircle2 size={12} /> 통과 {gateCounts.pass}
                    </span>
                    <span className="overview-gate-item overview-gate-item--fail">
                      <XCircle size={12} /> 실패 {gateCounts.fail}
                    </span>
                    <span className="overview-gate-item overview-gate-item--cds-support-warning">
                      <AlertTriangle size={12} /> 경고 {gateCounts.warning}
                    </span>
                  </div>
                </div>
              )}

              {/* Approvals */}
              <div
                className="overview-meta-section"
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/projects/${projectId}/approvals`)}
              >
                <div className="overview-meta-section__title">승인 요청</div>
                <div className="overview-approval-body">
                  {approvalCount.pending > 0 ? (
                    <div className="overview-approval-pending">
                      <span className="overview-approval-pending__count">{approvalCount.pending}</span>
                      <span className="overview-approval-pending__label">건 대기 중</span>
                    </div>
                  ) : (
                    <p className="overview-empty-text" style={{ padding: 0 }}>대기 없음</p>
                  )}
                  {approvalCount.total > 0 && (
                    <span className="overview-approval-total">총 {approvalCount.total}건</span>
                  )}
                </div>
              </div>

              {/* SDKs */}
              {registeredSdks.length > 0 && (
                <div
                  className="overview-meta-section"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/projects/${projectId}/settings`)}
                >
                  <div className="overview-meta-section__title">SDK ({registeredSdks.length}개)</div>
                  <div className="overview-sdk-body">
                    {registeredSdks.slice(0, 4).map((sdk) => (
                      <div key={sdk.id} className="overview-sdk-row">
                        <span className="overview-sdk-name">{sdk.name}</span>
                        <span style={{
                          color: sdk.status === "ready" ? "var(--cds-support-success)" : sdk.status.endsWith("_failed") ? "var(--cds-support-error)" : "var(--aegis-severity-medium)",
                          fontSize: "var(--cds-type-xs)",
                          fontWeight: "var(--cds-weight-medium)",
                        }}>
                          {sdk.status === "ready" ? "사용 가능" : sdk.status.endsWith("_failed") ? "실패" : "진행 중"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom grid: Files + Top vulns + Subprojects */}
          <div className="overview-bottom-grid">
            {/* Files */}
            <div className="card overview-files-card">
              <div
                className="card-title overview-file-header"
                onClick={() => navigate(`/projects/${projectId}/files`)}
              >
                <span className="flex-center flex-gap-2">
                  <FileText size={16} />
                  파일 ({projectFiles.length})
                  {projectFiles.length > 0 && (
                    <span className="overview-file-total-size">· {formatFileSize(projectFiles.reduce((s, f) => s + (f.size || 0), 0))}</span>
                  )}
                </span>
                <ChevronRight size={16} style={{ color: "var(--cds-text-placeholder)" }} />
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
                <span className="flex-center flex-gap-2">
                  <Shield size={16} />
                  주요 취약점
                </span>
                <ChevronRight size={16} style={{ color: "var(--cds-text-placeholder)" }} />
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
                <span className="flex-center flex-gap-2">
                  <HardDrive size={16} />
                  서브 프로젝트 ({bt.targets.length}개)
                </span>
                <ChevronRight size={16} style={{ color: "var(--cds-text-placeholder)" }} />
              </div>
              {overview.targetSummary && (
                <div className="overview-target-summary">
                  <span className="overview-target-summary__item overview-target-summary__item--ready">
                    <CheckCircle2 size={12} /> 준비 {overview.targetSummary.ready}
                  </span>
                  <span className="overview-target-summary__item overview-target-summary__item--running">
                    <Loader size={12} /> 진행 {overview.targetSummary.running}
                  </span>
                  <span className="overview-target-summary__item overview-target-summary__item--failed">
                    <XCircle size={12} /> 실패 {overview.targetSummary.failed}
                  </span>
                  <span className="overview-target-summary__item overview-target-summary__item--discovered">
                    <Search size={12} /> 감지 {overview.targetSummary.discovered}
                  </span>
                </div>
              )}
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
          </div>
        </>
      )}
    </div>
  );
};
