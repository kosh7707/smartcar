import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { ProjectReport, AnalysisModule } from "@aegis/shared";
import { FileText, Download, Filter, Calendar, X, Paperclip, Settings2 } from "lucide-react";
import { fetchProjectReport, ApiError, logError } from "../api/client";
import type { ReportFilters } from "../api/client";
import { CustomReportModal } from "../components/CustomReportModal";
import { useToast } from "../contexts/ToastContext";
import { MODULE_META } from "../constants/modules";
import { FINDING_STATUS_LABELS } from "../constants/finding";
import {
  PageHeader,
  EmptyState,
  Spinner,
  SeverityBadge,
  SeveritySummary,
  FindingStatusBadge,
  SourceBadge,
} from "../components/ui";
import { formatDateTime } from "../utils/format";
import "./ReportPage.css";

type ModuleTab = "all" | "static" | "deep" | "dynamic" | "test";

const MODULE_TAB_LABELS: Record<ModuleTab, string> = {
  all: "전체",
  static: "정적 분석",
  deep: "심층 분석",
  dynamic: "동적 분석",
  test: "동적 테스트",
};

const MODULE_KEY_MAP: Record<string, AnalysisModule> = {
  static: "static_analysis",
  deep: "deep_analysis",
  dynamic: "dynamic_analysis",
  test: "dynamic_testing",
};

export const ReportPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();

  const [report, setReport] = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<ModuleTab>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [pendingFilters, setPendingFilters] = useState<ReportFilters>({});

  const loadReport = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    setLoadError(false);
    fetchProjectReport(projectId, filters)
      .then(setReport)
      .catch((e) => {
        logError("Load report", e);
        setLoadError(true);
        const retry = e instanceof ApiError && e.retryable ? { label: "다시 시도", onClick: loadReport } : undefined;
        toast.error(e instanceof Error ? e.message : "보고서를 불러올 수 없습니다.", retry);
      })
      .finally(() => setLoading(false));
  }, [projectId, filters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleApplyFilters = () => {
    setFilters(pendingFilters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setPendingFilters({});
    setFilters({});
    setShowFilters(false);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="page-enter centered-loader--compact">
        <Spinner label="보고서 생성 중..." />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="page-enter">
        <PageHeader title="보고서" icon={<FileText size={20} />} />
        <EmptyState
          icon={<FileText size={28} />}
          title={loadError ? "보고서를 불러올 수 없습니다" : "보고서를 생성할 수 없습니다"}
          description={loadError ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." : "분석을 먼저 실행해주세요"}
          action={loadError ? (
            <button className="btn btn-secondary" onClick={loadReport}>다시 시도</button>
          ) : undefined}
        />
      </div>
    );
  }

  // Collect findings for active tab
  const activeModules = activeTab === "all"
    ? (["static", "deep", "dynamic", "test"] as const)
    : [activeTab] as const;

  const moduleEntries = activeModules
    .map((key) => ({ key, mod: report.modules[key] }))
    .filter((e) => e.mod != null);

  const allFindings = moduleEntries.flatMap((e) => e.mod!.findings);
  const allRuns = moduleEntries.flatMap((e) => e.mod!.runs);

  const summary = activeTab === "all"
    ? report.totalSummary
    : moduleEntries[0]?.mod?.summary ?? report.totalSummary;

  return (
    <div className="page-enter report-page">
      <PageHeader
        title="보고서"
        icon={<FileText size={20} />}
        subtitle={`생성: ${formatDateTime(report.generatedAt)}`}
        action={
          <div className="report-page__actions">
            <button
              className={`btn btn-secondary btn-sm${hasActiveFilters ? " report-page__filter-active" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={14} />
              필터{hasActiveFilters ? " (적용됨)" : ""}
            </button>
            <button className="btn btn-secondary btn-sm print-hide" onClick={() => setShowCustomReport(true)}>
              <Settings2 size={14} />
              커스텀 보고서
            </button>
            <button className="btn btn-sm print-hide" onClick={handlePrint}>
              <Download size={14} />
              PDF 내보내기
            </button>
          </div>
        }
      />

      {/* Filter panel */}
      {showFilters && (
        <div className="card report-filters animate-fade-in print-hide">
          <div className="report-filters__row">
            <div className="report-filters__field">
              <label className="report-filters__label"><Calendar size={12} /> 시작일</label>
              <input
                type="date"
                className="form-input"
                value={pendingFilters.from ?? ""}
                onChange={(e) => setPendingFilters({ ...pendingFilters, from: e.target.value || undefined })}
              />
            </div>
            <div className="report-filters__field">
              <label className="report-filters__label"><Calendar size={12} /> 종료일</label>
              <input
                type="date"
                className="form-input"
                value={pendingFilters.to ?? ""}
                onChange={(e) => setPendingFilters({ ...pendingFilters, to: e.target.value || undefined })}
              />
            </div>
            <div className="report-filters__field">
              <label className="report-filters__label">심각도</label>
              <select
                className="form-input"
                value={pendingFilters.severity ?? ""}
                onChange={(e) => setPendingFilters({ ...pendingFilters, severity: e.target.value || undefined })}
              >
                <option value="">전체</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="report-filters__field">
              <label className="report-filters__label">상태</label>
              <select
                className="form-input"
                value={pendingFilters.status ?? ""}
                onChange={(e) => setPendingFilters({ ...pendingFilters, status: e.target.value || undefined })}
              >
                <option value="">전체</option>
                {Object.entries(FINDING_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="report-filters__actions">
            <button className="btn btn-sm" onClick={handleApplyFilters}>적용</button>
            {hasActiveFilters && (
              <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
                <X size={12} /> 초기화
              </button>
            )}
          </div>
        </div>
      )}

      {/* Module tabs */}
      <div className="report-tabs print-hide">
        {(Object.keys(MODULE_TAB_LABELS) as ModuleTab[]).map((tab) => (
          <button
            key={tab}
            className={`report-tabs__item${activeTab === tab ? " report-tabs__item--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {MODULE_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="report-summary card">
        <div className="card-title">요약</div>
        <div className="report-summary__grid">
          <div className="report-summary__stat">
            <span className="report-summary__stat-value">{summary.totalFindings}</span>
            <span className="report-summary__stat-label">미해결 Finding</span>
          </div>
          <div className="report-summary__stat">
            <span className="report-summary__stat-value">{allRuns.length}</span>
            <span className="report-summary__stat-label">분석 실행</span>
          </div>
          <div className="report-summary__stat">
            <span className="report-summary__stat-value">
              {allRuns.filter((r) => r.gate?.status === "pass").length}/{allRuns.length}
            </span>
            <span className="report-summary__stat-label">Gate 통과율</span>
          </div>
        </div>

        <div className="report-summary__breakdown">
          <div className="report-summary__section">
            <span className="report-summary__section-label">심각도별</span>
            <SeveritySummary summary={{
              critical: summary.bySeverity.critical ?? 0,
              high: summary.bySeverity.high ?? 0,
              medium: summary.bySeverity.medium ?? 0,
              low: summary.bySeverity.low ?? 0,
              info: summary.bySeverity.info ?? 0,
            }} />
          </div>
          <div className="report-summary__section">
            <span className="report-summary__section-label">상태별</span>
            <div className="report-summary__status-list">
              {Object.entries(summary.byStatus)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <span key={status} className="report-summary__status-item">
                    {FINDING_STATUS_LABELS[status as keyof typeof FINDING_STATUS_LABELS] ?? status}: {count}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Findings table */}
      <div className="card">
        <div className="card-title">Finding 목록 ({allFindings.length})</div>
        {allFindings.length === 0 ? (
          <EmptyState compact title="해당 조건의 Finding이 없습니다" />
        ) : (
          <div className="report-findings">
            <div className="report-findings__header">
              <span className="report-findings__col--status">상태</span>
              <span className="report-findings__col--severity">심각도</span>
              <span className="report-findings__col--title">제목</span>
              <span className="report-findings__col--source">출처</span>
              <span className="report-findings__col--module">모듈</span>
              <span className="report-findings__col--evidence"><Paperclip size={10} /> 증적</span>
            </div>
            {allFindings.map(({ finding, evidenceRefs }) => (
              <div key={finding.id} className="report-findings__row">
                <span className="report-findings__col--status">
                  <FindingStatusBadge status={finding.status} size="sm" />
                </span>
                <span className="report-findings__col--severity">
                  <SeverityBadge severity={finding.severity} size="sm" />
                </span>
                <span className="report-findings__col--title">
                  <span className="report-findings__title">{finding.title}</span>
                  {finding.location && (
                    <span className="report-findings__location">{finding.location}</span>
                  )}
                </span>
                <span className="report-findings__col--source">
                  <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
                </span>
                <span className="report-findings__col--module">
                  {MODULE_META[finding.module]?.label ?? finding.module}
                </span>
                <span className="report-findings__col--evidence">
                  {evidenceRefs.length > 0 ? (
                    <span className="report-findings__evidence-count report-findings__evidence-count--has">
                      <Paperclip size={10} /> {evidenceRefs.length}
                    </span>
                  ) : (
                    <span className="report-findings__evidence-count">&mdash;</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Runs */}
      {allRuns.length > 0 && (
        <div className="card">
          <div className="card-title">Run 이력 ({allRuns.length})</div>
          <div className="report-runs">
            {allRuns.map(({ run, gate }) => (
              <div key={run.id} className="report-runs__row">
                <span className={`badge badge-sm badge-${run.status === "completed" ? "low" : run.status === "failed" ? "critical" : "info"}`}>
                  {run.status}
                </span>
                <span className="report-runs__module">
                  {MODULE_META[run.module]?.label ?? run.module}
                </span>
                <span className="report-runs__count">
                  Finding {run.findingCount}건
                </span>
                {gate && (
                  <span className={`badge badge-sm badge-${gate.status === "pass" ? "low" : gate.status === "fail" ? "critical" : "medium"}`}>
                    Gate: {gate.status}
                  </span>
                )}
                <span className="text-sm text-tertiary">
                  {formatDateTime(run.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approvals (full report only) */}
      {activeTab === "all" && report.approvals.length > 0 && (
        <div className="card">
          <div className="card-title">승인 이력 ({report.approvals.length})</div>
          {report.approvals.map((a) => (
            <div key={a.id} className="report-approval-row">
              <span className={`badge badge-sm badge-${a.status === "approved" ? "low" : a.status === "rejected" ? "critical" : "medium"}`}>
                {a.status}
              </span>
              <span>{a.actionType}</span>
              <span className="text-tertiary">요청: {a.requestedBy}</span>
              {a.decision && (
                <span className="text-tertiary">결정: {a.decision.decidedBy}</span>
              )}
              <span className="text-sm text-tertiary">{formatDateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Audit trail (full report only) */}
      {activeTab === "all" && report.auditTrail.length > 0 && (
        <div className="card">
          <div className="card-title">감사 추적 ({report.auditTrail.length})</div>
          <div className="report-audit">
            {report.auditTrail.map((entry) => (
              <div key={entry.id} className="report-audit__row">
                <span className="report-audit__time">{formatDateTime(entry.timestamp)}</span>
                <span className="report-audit__actor">{entry.actor}</span>
                <span className="report-audit__action">{entry.action}</span>
                <span className="text-tertiary text-sm">{entry.resource} {entry.resourceId?.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCustomReport && projectId && (
        <CustomReportModal projectId={projectId} onClose={() => setShowCustomReport(false)} />
      )}
    </div>
  );
};
