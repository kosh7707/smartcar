import React, { useEffect, useState } from "react";
import { useProjects } from "../../contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { NeedsAttentionSection } from "./components/NeedsAttentionSection";
import { ProjectExplorer } from "./components/ProjectExplorer";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { criticalOpenTotal, latestSyncLabel, pendingApprovalsTotal } from "./dashboardProjectSignals";
import { getDashboardAttentionState } from "./dashboardAttentionState";
import { useDashboardActivityFeed } from "./hooks/useDashboardActivityFeed";
import { useDashboardCreateForm } from "./hooks/useDashboardCreateForm";
import { useDashboardDocumentTitle } from "./hooks/useDashboardDocumentTitle";
import { useDashboardExplorerState } from "./hooks/useDashboardExplorerState";

type Density = "comfortable" | "compact";
type LayoutMode = "table" | "cards";

export const DashboardPage: React.FC = () => {
  const { projects, loading, createProject } = useProjects();
  const [showTweaks, setShowTweaks] = useState(false);
  const [density, setDensity] = useState<Density>(() => (localStorage.getItem("aegis:tweaks:density") as Density) || "comfortable");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => (localStorage.getItem("aegis:tweaks:layout") as LayoutMode) || "table");
  const [showActivity, setShowActivity] = useState(() => localStorage.getItem("aegis:tweaks:activity") !== "false");
  const [showLive, setShowLive] = useState(() => localStorage.getItem("aegis:tweaks:live") === "true");

  useDashboardDocumentTitle();

  const { filter, setFilter, filteredProjects, emptyState } = useDashboardExplorerState({ projects, loading });
  const { attentionProjects, hasProjectContext } = getDashboardAttentionState({ projects, filteredProjects });
  const { visibleActivity, hasMore, loadMore, connectionState } = useDashboardActivityFeed({ projects });
  const { createFlow } = useDashboardCreateForm({ createProject });
  const criticalOpen = criticalOpenTotal(projects);
  const pendingApprovals = pendingApprovalsTotal(projects);
  const latestSync = latestSyncLabel(projects);

  useEffect(() => {
    document.body.classList.toggle("density-compact", density === "compact");
    document.body.classList.toggle("layout-cards", layoutMode === "cards");
    document.body.classList.toggle("no-activity", !showActivity);
    document.body.classList.toggle("no-live", !showLive);
    localStorage.setItem("aegis:tweaks:density", density);
    localStorage.setItem("aegis:tweaks:layout", layoutMode);
    localStorage.setItem("aegis:tweaks:activity", String(showActivity));
    localStorage.setItem("aegis:tweaks:live", String(showLive));

    return () => {
      document.body.classList.remove("density-compact", "layout-cards", "no-activity", "no-live");
    };
  }, [density, layoutMode, showActivity, showLive]);

  return (
    <>
      <main className="main">
        <header className="page-head" data-chore>
          <div className="chore c-1">
            <h1>안녕하세요, 보안 분석가 <em>— 오늘 주의 필요 <span className="crit-n">{attentionProjects.length}건</span></em></h1>
            <div className="sub">
              <span><b>{projects.length}</b> 프로젝트 활성</span>
              <span className="sep">·</span>
              <span><span className="critical">{criticalOpen} critical</span> open</span>
              <span className="sep">·</span>
              <span><b>{pendingApprovals}</b> 승인 대기</span>
              <span className="sep">·</span>
              <span>마지막 동기화 {latestSync} UTC+9</span>
            </div>
          </div>
          <div className="actions chore c-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowTweaks((v) => !v)}>뷰</Button>
            <Button type="button" size="sm" onClick={createFlow.onToggle}>새 프로젝트</Button>
          </div>
        </header>

        <NeedsAttentionSection projects={attentionProjects} hasProjectContext={hasProjectContext} />

        <div className="cols" data-chore>
          <section className="chore c-3">
            <ProjectExplorer projects={filteredProjects} filter={filter} emptyState={emptyState} onFilterChange={setFilter} createFlow={createFlow} layoutMode={layoutMode} />
          </section>
          {showActivity ? (
            <section className="chore c-4">
              <RecentActivitySection visibleActivity={visibleActivity} hasMore={hasMore} onLoadMore={loadMore} connectionState={connectionState} />
            </section>
          ) : null}
        </div>
      </main>

      <aside className={`tweaks${showTweaks ? ' show' : ''}`}>
        <div className="tweaks-head">
          <span className="title">TWEAKS</span>
          <button onClick={() => setShowTweaks(false)} aria-label="닫기">×</button>
        </div>
        <div className="tweaks-body">
          <div className="tweak-group">
            <label>밀도</label>
            <div className="seg" data-group="density">
              <button className={density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')}>COMFORTABLE</button>
              <button className={density === 'compact' ? 'active' : ''} onClick={() => setDensity('compact')}>COMPACT</button>
            </div>
          </div>
          <div className="tweak-group">
            <label>레이아웃</label>
            <div className="seg" data-group="layout">
              <button className={layoutMode === 'table' ? 'active' : ''} onClick={() => setLayoutMode('table')}>TABLE</button>
              <button className={layoutMode === 'cards' ? 'active' : ''} onClick={() => setLayoutMode('cards')}>CARDS</button>
            </div>
          </div>
          <div className="toggle-row"><span>활동 피드 표시</span><button className={`toggle ${showActivity ? 'on' : ''}`} onClick={() => setShowActivity((v) => !v)} /></div>
          <div className="toggle-row"><span>라이브 스트림 강조</span><button className={`toggle ${showLive ? 'on' : ''}`} onClick={() => setShowLive((v) => !v)} /></div>
        </div>
      </aside>
    </>
  );
};
