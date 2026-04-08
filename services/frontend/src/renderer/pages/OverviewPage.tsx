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
            <span className="stat-card__lang-dot" style={{ background: LANG_COLORS[lang] || "var(--cds-text-placeholder)" }} />
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
  const [gates, setGates] = useState<GateResult[]>([]);
  const [approvalCount, setApprovalCount] = useState<{ pending: number; total: number }>({ pending: 0, total: 0 });
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
      fetchProjectGates(projectId)
        .then(setGates)
        .catch(() => setGates([]));
      fetchApprovalCount(projectId)
        .then(setApprovalCount)
        .catch(() => setApprovalCount({ pending: 0, total: 0 }));
    }
  }, [projectId]);

  const recentAnalyses = overview?.recentAnalyses ?? [];
  const latestMap = useMemo(() => getLatestPerModule(recentAnalyses), [recentAnalyses]);
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
  const hasAnalysis = recentAnalyses.length > 0;
  const hasFiles = projectFiles.length > 0;
  const isEmpty = !hasAnalysis && !hasFiles;

  return (
    <div className="page-enter">
      <PageHeader
        title={project.name}
        icon={<LayoutDashboard size={20} />}
        subtitle={project.description || undefined}
      />

      {/* Empty state: no files AND no analysis */}
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

      {/* Security posture group: Donut + modules + stats */}
      {!isEmpty && <div className="overview-posture-group">
        <div className="card" style={{ marginBottom: "var(--cds-spacing-04)" }}>
          <div className="overview-security-card">
            <DonutChart summary={sev} size={140} showLegend={false} centerLabel="전체 Finding" />
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
        <StatCard icon={<AlertTriangle size={16} />} label="Critical" value={sev.critical} color="var(--aegis-severity-critical)" detail={getModuleBreakdown(latestMap, "critical")} onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=critical`)} />
        <StatCard icon={<AlertTriangle size={16} />} label="High" value={sev.high} color="var(--aegis-severity-high)" detail={getModuleBreakdown(latestMap, "high")} onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=high`)} />
        <StatCard icon={<AlertCircle size={16} />} label="Medium" value={sev.medium} color="var(--aegis-severity-medium)" detail={getModuleBreakdown(latestMap, "medium")} onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=medium`)} />
        <StatCard icon={<Info size={16} />} label="Low" value={sev.low} color="var(--aegis-severity-low)" detail={getModuleBreakdown(latestMap, "low")} onClick={() => navigate(`/projects/${projectId}/vulnerabilities?severity=low`)} />
        </div>
      </div>}

      {/* Trend card — hide when all values are zero */}
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

      {/* Bottom grid: Files + History */}
      <div className="overview-bottom-grid">
        {/* Files */}
        <div className="card overview-files-card">
          <div
            className="card-title overview-file-header"
            onClick={() => navigate(`/projects/${projectId}/files`)}
          >
            <span className="flex-center flex-gap-2">
              <FileText size={16} />
              업로드된 파일 ({projectFiles.length}){projectFiles.length > 0 && <span className="overview-file-total-size">· {formatFileSize(projectFiles.reduce((sum, f) => sum + (f.size || 0), 0))}</span>}
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

        {/* Quality Gate */}
        <div className="card overview-gate-card">
          <div
            className="card-title overview-gate-header"
            onClick={() => navigate(`/projects/${projectId}/quality-gate`)}
          >
            <span className="flex-center flex-gap-2">
              <ShieldCheck size={16} />
              Quality Gate ({gates.length}개)
            </span>
            <ChevronRight size={16} style={{ color: "var(--cds-text-placeholder)" }} />
          </div>
          {gates.length === 0 ? (
            <p className="overview-empty-text">평가된 Gate가 없습니다.</p>
          ) : (
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
          )}
        </div>

        {/* Approval */}
        <div className="card overview-approval-card">
          <div
            className="card-title overview-approval-header"
            onClick={() => navigate(`/projects/${projectId}/approvals`)}
          >
            <span className="flex-center flex-gap-2">
              <ClipboardCheck size={16} />
              승인 요청
            </span>
            <ChevronRight size={16} style={{ color: "var(--cds-text-placeholder)" }} />
          </div>
          <div className="overview-approval-body">
            {approvalCount.pending > 0 ? (
              <div className="overview-approval-pending">
                <span className="overview-approval-pending__count">{approvalCount.pending}</span>
                <span className="overview-approval-pending__label">건 대기 중</span>
              </div>
            ) : (
              <p className="overview-empty-text">대기 중인 승인 요청이 없습니다.</p>
            )}
            {approvalCount.total > 0 && (
              <span className="overview-approval-total">총 {approvalCount.total}건</span>
            )}
          </div>
        </div>

        {/* SDK */}
        <div className="card overview-sdk-card">
          <div
            className="card-title overview-sdk-header"
            onClick={() => navigate(`/projects/${projectId}/settings`)}
          >
            <span className="flex-center flex-gap-2">
              <Settings size={16} />
              SDK ({registeredSdks.length}개)
            </span>
            <ChevronRight size={16} style={{ color: "var(--cds-text-placeholder)" }} />
          </div>
          {registeredSdks.length === 0 ? (
            <p className="overview-empty-text">등록된 SDK가 없습니다.</p>
          ) : (
            <div className="overview-sdk-body">
              {registeredSdks.map((sdk) => (
                <div key={sdk.id} className="overview-sdk-row">
                  <span className="overview-sdk-name">{sdk.name}</span>
                  <span className="overview-sdk-status" style={{
                    color: sdk.status === "ready" ? "var(--cds-support-success)" : sdk.status.endsWith("_failed") ? "var(--cds-support-error)" : "var(--aegis-severity-medium)",
                    fontSize: "var(--cds-type-xs)",
                    fontWeight: "var(--cds-weight-medium)",
                  }}>
                    {sdk.status === "ready" ? "사용 가능" : sdk.status.endsWith("_failed") ? "실패" : "진행 중"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="card overview-history-card">
          <div className="card-title overview-history-header">
            <span className="flex-center flex-gap-2">
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
