import React, { useState } from "react";
import type {
  AnalysisProgress,
  Run,
  RunDetailResponse,
  StaticAnalysisDashboardSummary,
} from "@aegis/shared";
import { Code, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardPeriod } from "../../../shared/ui/PeriodSelector";
import { ActiveAnalysisBanner } from "./ActiveAnalysisBanner";
import { LatestAnalysisTab } from "./LatestAnalysisTab";
import { OverallStatusTab } from "./OverallStatusTab";

type TabId = "latest" | "overall";

interface Props {
  projectId: string;
  summary: StaticAnalysisDashboardSummary;
  recentRuns: Run[];
  activeAnalysis: AnalysisProgress | null;
  latestRunDetail: RunDetailResponse["data"] | null;
  latestRunLoading: boolean;
  period: DashboardPeriod;
  onPeriodChange: (p: DashboardPeriod) => void;
  onNewAnalysis: () => void;
  onViewRun: (runId: string) => void;
  onSelectFinding: (findingId: string) => void;
  onResumeAnalysis: () => void;
  onAbortAnalysis: () => void;
  onFileClick?: (filePath: string) => void;
  onBrowseTree?: () => void;
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
    return new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

export const StaticDashboard: React.FC<Props> = ({
  summary,
  recentRuns,
  activeAnalysis,
  latestRunDetail,
  latestRunLoading,
  period,
  onPeriodChange,
  onNewAnalysis,
  onViewRun,
  onSelectFinding,
  onResumeAnalysis,
  onAbortAnalysis,
  onFileClick,
  onBrowseTree,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("latest");

  const lastRunIso = recentRuns[0]?.startedAt ?? recentRuns[0]?.endedAt ?? null;
  const totalFindings = Object.values(summary.bySeverity).reduce((a, b) => a + b, 0);
  const critCount = summary.bySeverity.critical ?? 0;
  const highCount = summary.bySeverity.high ?? 0;
  const gatePassed = summary.gateStats.passed;
  const gateTotal = summary.gateStats.total;

  return (
    <div className="page-shell static-dashboard-shell" data-chore>
      <header className="page-head chore c-1">
        <div>
          <h1>정적 분석</h1>
          <div className="sub">
            <span className="sub-caps">LAST RUN</span>
            <b>{toRelative(lastRunIso)}</b>
            <span className="sep" aria-hidden="true">·</span>
            <span className="sub-caps">FINDINGS</span>
            <b className={cn(critCount > 0 && "is-critical")}>{totalFindings}</b>
            {critCount > 0 && (
              <>
                <span className="sep" aria-hidden="true">·</span>
                <span className="sub-caps">CRITICAL</span>
                <b className="is-critical">{critCount}</b>
              </>
            )}
            {highCount > 0 && (
              <>
                <span className="sep" aria-hidden="true">·</span>
                <span className="sub-caps">HIGH</span>
                <b className="is-high">{highCount}</b>
              </>
            )}
            <span className="sep" aria-hidden="true">·</span>
            <span className="sub-caps">GATE</span>
            <b>{gateTotal === 0 ? "—" : `${gatePassed}/${gateTotal}`}</b>
          </div>
        </div>
        <div className="actions">
          {onBrowseTree && (
            <button type="button" className="btn btn-outline" onClick={onBrowseTree}>
              <Code size={16} />
              소스 탐색
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onNewAnalysis}>
            <Plus size={16} />
            새 분석
          </button>
        </div>
      </header>

      {activeAnalysis && (
        <ActiveAnalysisBanner
          progress={activeAnalysis}
          onView={onResumeAnalysis}
          onAbort={onAbortAnalysis}
        />
      )}

      <nav className="static-dashboard-tabs chore c-2" aria-label="대시보드 탭">
        <div className="filter-pills filter-pills--tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "latest"}
            className={cn("pill", activeTab === "latest" && "active")}
            onClick={() => setActiveTab("latest")}
          >
            최신 분석
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overall"}
            className={cn("pill", activeTab === "overall" && "active")}
            onClick={() => setActiveTab("overall")}
          >
            전체 현황
          </button>
        </div>
      </nav>

      <div className="chore c-3">
        {activeTab === "latest" ? (
          <LatestAnalysisTab
            runDetail={latestRunDetail}
            loading={latestRunLoading}
            onSelectFinding={onSelectFinding}
            onFileClick={onFileClick}
            onNewAnalysis={onNewAnalysis}
          />
        ) : (
          <OverallStatusTab
            summary={summary}
            recentRuns={recentRuns}
            period={period}
            onPeriodChange={onPeriodChange}
            onViewRun={onViewRun}
            onFileClick={onFileClick}
          />
        )}
      </div>
    </div>
  );
};
