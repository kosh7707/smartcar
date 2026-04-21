import React, { useState } from "react";
import type { AnalysisProgress, Run, RunDetailResponse, StaticAnalysisDashboardSummary } from "@aegis/shared";
import { Code, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardPeriod } from "../../../shared/ui/PeriodSelector";
import { PageHeader } from "../../../shared/ui";
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
    <div className="page-shell static-dashboard-shell">
      <PageHeader
        title="정적 분석"
        action={
          <div className="static-dashboard-actions">
            {onBrowseTree && (
              <Button variant="outline" onClick={onBrowseTree}>
                <Code size={16} />
                소스 탐색
              </Button>
            )}
            <Button onClick={onNewAnalysis}>
              <Plus size={16} />
              새 분석
            </Button>
          </div>
        }
      />

      {activeAnalysis && (
        <ActiveAnalysisBanner
          progress={activeAnalysis}
          onView={onResumeAnalysis}
          onAbort={onAbortAnalysis}
        />
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="static-dashboard-tabs">
        <TabsList
          variant="line"
          className="static-dashboard-tabs__list"
        >
          <TabsTrigger
            value="latest"
            className="static-dashboard-tabs__trigger"
          >
            최신 분석
          </TabsTrigger>
          <TabsTrigger
            value="overall"
            className="static-dashboard-tabs__trigger"
          >
            전체 현황
          </TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
};
