import React, { useState } from "react";
import type {
  AnalysisProgress,
  Run,
  RunDetailResponse,
  StaticAnalysisDashboardSummary,
} from "@aegis/shared";
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

type Tone = "neutral" | "info" | "warn" | "critical" | "ok";

interface IdentityStat {
  label: string;
  value: string;
  tone?: Tone;
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

function toneClass(tone?: Tone): string {
  switch (tone) {
    case "info": return "static-dashboard-identity__stat--info";
    case "warn": return "static-dashboard-identity__stat--warn";
    case "critical": return "static-dashboard-identity__stat--critical";
    case "ok": return "static-dashboard-identity__stat--ok";
    default: return "";
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
  const gateFailed = gateTotal - gatePassed;

  const findingsTone: Tone =
    totalFindings === 0 ? "ok"
    : critCount > 0 ? "critical"
    : highCount > 0 ? "warn"
    : "info";

  const gateTone: Tone =
    gateTotal === 0 ? "neutral"
    : gateFailed === 0 ? "ok"
    : gateFailed > 0 ? "critical"
    : "neutral";

  const identityStats: IdentityStat[] = [
    { label: "LAST RUN", value: toRelative(lastRunIso), tone: lastRunIso ? "info" : "neutral" },
    { label: "FINDINGS", value: String(totalFindings), tone: findingsTone },
    { label: "CRITICAL", value: String(critCount), tone: critCount > 0 ? "critical" : "neutral" },
    { label: "HIGH", value: String(highCount), tone: highCount > 0 ? "warn" : "neutral" },
    { label: "GATE", value: gateTotal === 0 ? "—" : `${gatePassed}/${gateTotal}`, tone: gateTone },
  ];

  return (
    <div className="page-shell static-dashboard-shell">
      <div className="static-dashboard-identity">
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
        <dl className="static-dashboard-identity__strip" aria-label="정적 분석 지표">
          {identityStats.map((stat) => (
            <div
              key={stat.label}
              className={`static-dashboard-identity__stat ${toneClass(stat.tone)}`.trim()}
            >
              <dt className="static-dashboard-identity__label">{stat.label}</dt>
              <dd className="static-dashboard-identity__value">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {activeAnalysis && (
        <ActiveAnalysisBanner
          progress={activeAnalysis}
          onView={onResumeAnalysis}
          onAbort={onAbortAnalysis}
        />
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabId)}
        className="static-dashboard-tabs"
      >
        <TabsList variant="line" className="static-dashboard-tabs__list">
          <TabsTrigger value="latest" className="static-dashboard-tabs__trigger">
            최신 분석
          </TabsTrigger>
          <TabsTrigger value="overall" className="static-dashboard-tabs__trigger">
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
