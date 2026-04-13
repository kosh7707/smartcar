import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { ProjectReport, AnalysisModule } from "@aegis/shared";
import { CheckCircle, Clock } from "lucide-react";
import { fetchProjectReport, ApiError, logError } from "../../api/client";
import type { ReportFilters } from "../../api/client";
import { CustomReportModal } from "./components/CustomReportModal";
import { ReportFiltersPanel } from "./components/ReportFiltersPanel";
import { ReportFindingsSection } from "./components/ReportFindingsSection";
import { ReportHeader } from "./components/ReportHeader";
import { ReportRunsSection } from "./components/ReportRunsSection";
import { useToast } from "../../contexts/ToastContext";
import { MODULE_META } from "../../constants/modules";
import { FINDING_STATUS_LABELS } from "../../constants/finding";
import {
  EmptyState,
  Spinner,
  SeveritySummary,
} from "../../shared/ui";
import { formatDateTime } from "../../utils/format";
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

  useEffect(() => {
    document.title = "AEGIS — Report";
  }, []);

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
        <ReportHeader
          generatedAt={new Date().toISOString()}
          hasActiveFilters={hasActiveFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onOpenCustomReport={() => setShowCustomReport(true)}
          onPrint={handlePrint}
        />
        <EmptyState
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

  // Severity bar chart heights (relative to max)
  const sevCounts = {
    critical: summary.bySeverity.critical ?? 0,
    high: summary.bySeverity.high ?? 0,
    medium: summary.bySeverity.medium ?? 0,
    low: summary.bySeverity.low ?? 0,
  };
  const sevMax = Math.max(1, ...Object.values(sevCounts));

  return (
    <div className="page-enter report-page">
      <ReportHeader
        generatedAt={report.generatedAt}
        hasActiveFilters={hasActiveFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onOpenCustomReport={() => setShowCustomReport(true)}
        onPrint={handlePrint}
      />

      {showFilters && (
        <ReportFiltersPanel
          pendingFilters={pendingFilters}
          setPendingFilters={setPendingFilters}
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
        />
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

      {/* Bento: Executive Summary + Audit Trail */}
      <div className="report-bento">
        {/* Executive Summary */}
        <div className="card report-exec-card">
          <div className="report-exec-card__accent" />
          <div className="card-title">Executive Summary</div>

          <div className="report-exec-card__meta-grid">
            <div className="report-exec-meta-item">
              <span className="report-exec-meta-item__label">분석 날짜</span>
              <span className="report-exec-meta-item__value">{formatDateTime(report.generatedAt).split(" ")[0]}</span>
            </div>
            <div className="report-exec-meta-item">
              <span className="report-exec-meta-item__label">컴플라이언스</span>
              <span className={`report-compliance-badge ${allRuns.some((r) => r.gate?.status === "fail") ? "report-compliance-badge--fail" : "report-compliance-badge--pass"}`}>
                {allRuns.some((r) => r.gate?.status === "fail") ? "FAIL" : "PASS"}
              </span>
            </div>
            <div className="report-exec-meta-item">
              <span className="report-exec-meta-item__label">분석 실행</span>
              <span className="report-exec-meta-item__value">{allRuns.length}</span>
            </div>
            <div className="report-exec-meta-item">
              <span className="report-exec-meta-item__label">총 Finding</span>
              <span className="report-exec-meta-item__value--large">{summary.totalFindings}</span>
            </div>
          </div>

          {/* Severity bar chart */}
          <div className="report-severity-chart">
            <span className="report-severity-chart__label">심각도 분포</span>
            <div className="report-severity-chart__bars">
              {(["critical", "high", "medium", "low"] as const).map((sev) => (
                <div key={sev} className="report-severity-bar">
                  <span className="report-severity-bar__value">{sevCounts[sev]}</span>
                  <div
                    className={`report-severity-bar__fill report-severity-bar__fill--${sev}`}
                    style={{ height: `${Math.max(5, (sevCounts[sev] / sevMax) * 72)}px` }}
                  />
                  <span className="report-severity-bar__name">{sev.charAt(0).toUpperCase() + sev.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="card report-audit-card">
          <span className="report-audit-card__title">Audit Trail</span>
          <div className="report-audit-timeline">
            {report.auditTrail.length === 0 ? (
              <p style={{ fontSize: "var(--cds-type-sm)", color: "var(--cds-text-placeholder)", margin: 0 }}>감사 이력 없음</p>
            ) : (
              report.auditTrail.slice(0, 5).map((entry, idx) => (
                <div key={entry.id} className="report-audit-item">
                  <div className={`report-audit-item__dot ${idx < report.auditTrail.length - 1 ? "report-audit-item__dot--done" : "report-audit-item__dot--pending"}`}>
                    {idx < report.auditTrail.length - 1
                      ? <CheckCircle size={14} />
                      : <Clock size={14} />}
                  </div>
                  <p className="report-audit-item__title">{entry.action}</p>
                  <span className="report-audit-item__time">{formatDateTime(entry.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* By-Target Breakdown */}
      {activeTab === "all" && (
        <div className="card report-breakdown">
          <div className="card-title">모듈별 분석 현황</div>
          <table className="report-breakdown-table">
            <thead>
              <tr>
                <th>모듈</th>
                <th>Finding</th>
                <th>Gate 통과</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {moduleEntries.map(({ key, mod }) => (
                <tr key={key}>
                  <td>
                    <span className="report-breakdown__target-name">{MODULE_META[MODULE_KEY_MAP[key]]?.label ?? key}</span>
                    <span className="report-breakdown__target-id">{MODULE_KEY_MAP[key]}</span>
                  </td>
                  <td><span className="report-breakdown__count">{mod!.summary.totalFindings}</span></td>
                  <td>
                    {mod!.runs.filter((r) => r.gate?.status === "pass").length}/{mod!.runs.length}
                  </td>
                  <td>
                    <span className="report-breakdown__status">
                      {mod!.runs.some((r) => r.gate?.status === "fail") ? "ISSUE" : "STABLE"}
                    </span>
                  </td>
                </tr>
              ))}
              {moduleEntries.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--cds-text-placeholder)", padding: "var(--cds-spacing-07) 0" }}>
                    해당 모듈 데이터 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary stats */}
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

      <ReportFindingsSection findings={allFindings} />

      <ReportRunsSection runs={allRuns} />

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

      {/* Full audit log */}
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
