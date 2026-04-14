import React, { useState } from "react";
import type { StaticAnalysisDashboardSummary, Run, AnalysisProgress, RunDetailResponse } from "@aegis/shared";
import type { DashboardPeriod } from "../../../shared/ui/PeriodSelector";
import { PageHeader } from "../../../shared/ui";
import { Plus, Code } from "lucide-react";
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

  return (
    <div className="page-enter">
      <PageHeader
        title="정적 분석"
        action={
          <div style={{ display: "flex", gap: "var(--cds-spacing-03)" }}>
            {onBrowseTree && (
              <button className="btn btn-secondary" onClick={onBrowseTree}>
                <Code size={16} />
                소스 탐색
              </button>
            )}
            <button className="btn" onClick={onNewAnalysis}>
              <Plus size={16} />
              새 분석
            </button>
          </div>
        }
      />

      {/* Active Analysis Banner (always visible above tabs) */}
      {activeAnalysis && (
        <ActiveAnalysisBanner
          progress={activeAnalysis}
          onView={onResumeAnalysis}
          onAbort={onAbortAnalysis}
        />
      )}

      {/* Tab Bar */}
      <div className="static-dashboard-tabs">
        <button
          className={`static-dashboard-tabs__item${activeTab === "latest" ? " static-dashboard-tabs__item--active" : ""}`}
          onClick={() => setActiveTab("latest")}
        >
          최신 분석
        </button>
        <button
          className={`static-dashboard-tabs__item${activeTab === "overall" ? " static-dashboard-tabs__item--active" : ""}`}
          onClick={() => setActiveTab("overall")}
        >
          전체 현황
        </button>
      </div>

      {/* Tab Content */}
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
  );
};
