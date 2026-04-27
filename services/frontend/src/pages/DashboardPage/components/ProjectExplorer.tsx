import React, { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { CreateProjectForm } from "./CreateProjectForm";
import type { DashboardProject } from "../dashboardTypes";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import type { ProjectExplorerEmptyState } from "../hooks/useDashboardExplorerState";
import {
  projectDisplayWhen,
  projectIsRunning,
  projectOwner,
  projectPendingApprovals,
  totalFindings,
} from "../dashboardProjectSignals";

export interface DashboardExplorerCreateFlow {
  show: boolean;
  name: string;
  description: string;
  onToggle: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

interface ProjectExplorerProps {
  projects: DashboardProject[];
  filter: string;
  emptyState: ProjectExplorerEmptyState;
  onFilterChange: (value: string) => void;
  createFlow: DashboardExplorerCreateFlow;
  layoutMode?: "table" | "cards";
}

type StatusFilter = "all" | "blocked" | "running" | "stale";
type SortKey = "name" | "gate" | "critical" | "high" | "medium" | "open" | "approvals" | "recent";
type SortOrder = "asc" | "desc";

function isStale(project: DashboardProject): boolean {
  if (!project.lastAnalysisAt) return true;
  const ageDays = (Date.now() - new Date(project.lastAnalysisAt).getTime()) / 86_400_000;
  return ageDays >= 7;
}

const GATE_RANK: Record<string, number> = { fail: 0, warning: 1, running: 2, pass: 3 };

const NATURAL_DESC: Record<SortKey, SortOrder> = {
  name: "asc",
  gate: "asc",
  critical: "desc",
  high: "desc",
  medium: "desc",
  open: "desc",
  approvals: "desc",
  recent: "desc",
};

function compareProjects(a: DashboardProject, b: DashboardProject, key: SortKey): number {
  switch (key) {
    case "recent": {
      const at = a.lastAnalysisAt ? new Date(a.lastAnalysisAt).getTime() : 0;
      const bt = b.lastAnalysisAt ? new Date(b.lastAnalysisAt).getTime() : 0;
      return bt - at;
    }
    case "name":
      return a.name.localeCompare(b.name, "ko");
    case "critical":
      return (b.severitySummary?.critical ?? 0) - (a.severitySummary?.critical ?? 0);
    case "high":
      return (b.severitySummary?.high ?? 0) - (a.severitySummary?.high ?? 0);
    case "medium":
      return (b.severitySummary?.medium ?? 0) - (a.severitySummary?.medium ?? 0);
    case "open":
      return totalFindings(b) - totalFindings(a);
    case "approvals":
      return projectPendingApprovals(b) - projectPendingApprovals(a);
    case "gate": {
      const ar = GATE_RANK[(a.gateStatus ?? "pass") as string] ?? 9;
      const br = GATE_RANK[(b.gateStatus ?? "pass") as string] ?? 9;
      return ar - br;
    }
  }
}

function gateLabel(project: DashboardProject): { cls: string; txt: string } {
  if (projectIsRunning(project)) return { cls: "running", txt: "RUNNING" };
  if (project.gateStatus === "fail") return { cls: "blocked", txt: "BLOCK" };
  if (project.gateStatus === "warning") return { cls: "warn", txt: "WARN" };
  return { cls: "pass", txt: "PASS" };
}

function ProjectCards({ projects }: { projects: DashboardProject[] }) {
  return (
    <div className="ptable-cards">
      {projects.map((project) => {
        const gate = gateLabel(project);
        const critical = project.severitySummary?.critical ?? 0;
        const high = project.severitySummary?.high ?? 0;
        const medium = project.severitySummary?.medium ?? 0;
        const low = project.severitySummary?.low ?? 0;
        const approvals = projectPendingApprovals(project);
        return (
          <Link key={`${project.id}-card`} to={`/projects/${project.id}/overview`} className="att-card-link">
            <article className="pcard">
              <div className="pc-head">
                <div>
                  <div className="pc-name">{project.name}</div>
                  <div className="pc-meta">{project.description} · {projectDisplayWhen(project)}</div>
                </div>
                <span className={`cell-gate ${gate.cls}`}>{gate.txt}</span>
              </div>
              <div className="pc-chips">
                {critical ? <span className="chip-sev critical">{critical}</span> : null}
                {high ? <span className="chip-sev high">{high}</span> : null}
                {medium ? <span className="chip-sev medium">{medium}</span> : null}
                {low ? <span className="chip-sev low">{low}</span> : null}
                {approvals ? <span className="approvals-pill">{approvals} 승인</span> : null}
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ projects, filter, emptyState, onFilterChange, createFlow, layoutMode = "table" }) => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleRowActivate = useCallback((projectId: string) => {
    navigate(`/projects/${projectId}/overview`);
  }, [navigate]);

  const handleRowKeyDown = useCallback((event: React.KeyboardEvent<HTMLTableRowElement>, projectId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowActivate(projectId);
    }
  }, [handleRowActivate]);

  const displayProjects = useMemo(() => {
    let list: DashboardProject[];
    switch (statusFilter) {
      case "blocked":
        list = projects.filter((project) => project.gateStatus === "fail");
        break;
      case "running":
        list = projects.filter(projectIsRunning);
        break;
      case "stale":
        list = projects.filter(isStale);
        break;
      default:
        list = projects;
    }
    const sorted = [...list].sort((a, b) => compareProjects(a, b, sortKey));
    return sortOrder === NATURAL_DESC[sortKey] ? sorted : sorted.reverse();
  }, [projects, statusFilter, sortKey, sortOrder]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortOrder(NATURAL_DESC[key]);
      return key;
    });
  }, []);

  const sortHeaderProps = (key: SortKey, extraClass?: string) => {
    const active = sortKey === key;
    const isAsc = active && sortOrder === "asc";
    return {
      className: ["sort", extraClass, active ? "active" : "", isAsc ? "asc" : ""].filter(Boolean).join(" "),
      role: "button" as const,
      tabIndex: 0,
      "aria-sort": (active ? (isAsc ? "ascending" : "descending") : "none") as React.AriaAttributes["aria-sort"],
      onClick: () => handleSort(key),
      onKeyDown: (event: React.KeyboardEvent<HTMLTableCellElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSort(key);
        }
      },
    };
  };

  const emptyAction = emptyState.actionKind === "clear-filter"
    ? <button type="button" className="btn btn-outline btn-sm" onClick={() => onFilterChange("")}>검색 초기화</button>
    : emptyState.actionKind === "start-project"
      ? <button type="button" className="btn btn-outline btn-sm" onClick={createFlow.onToggle}>새 프로젝트 시작</button>
      : undefined;

  return (
    <section className="panel projects-panel" aria-label="프로젝트 탐색기">
      <div className="panel-head">
        <h3>프로젝트 <span className="count">{displayProjects.length}</span></h3>
        <div className="panel-tools">
          <div className="filter-pills" id="filter-pills">
            <button className={`pill ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>ALL</button>
            <button className={`pill ${statusFilter === "blocked" ? "active" : ""}`} onClick={() => setStatusFilter("blocked")}><span className="dot blocked"></span>BLOCKED</button>
            <button className={`pill ${statusFilter === "running" ? "active" : ""}`} onClick={() => setStatusFilter("running")}><span className="dot running"></span>RUNNING</button>
            <button className={`pill ${statusFilter === "stale" ? "active" : ""}`} onClick={() => setStatusFilter("stale")}>STALE</button>
          </div>
          <div className="search-inline">
            <Search size={14} />
            <input type="search" placeholder="프로젝트 이름…" value={filter} onChange={(event) => onFilterChange(event.target.value)} />
          </div>
          {layoutMode === "cards" ? (
            <div className="filter-sort-wrap" aria-label="정렬">
              <select
                className="filter-select"
                aria-label="정렬 기준"
                value={sortKey}
                onChange={(event) => handleSort(event.target.value as SortKey)}
              >
                <option value="recent">마지막 분석</option>
                <option value="name">이름</option>
                <option value="critical">크리티컬</option>
                <option value="gate">게이트 상태</option>
              </select>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                aria-label={sortOrder === "asc" ? "오름차순" : "내림차순"}
              >
                {sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="surface-panel-body">
        {createFlow.show ? (
          <CreateProjectForm
            name={createFlow.name}
            description={createFlow.description}
            onNameChange={createFlow.onNameChange}
            onDescriptionChange={createFlow.onDescriptionChange}
            onCreate={createFlow.onSubmit}
            onCancel={createFlow.onCancel}
          />
        ) : null}

        {displayProjects.length === 0 ? (
          <DashboardEmptySurface title={emptyState.title} description={emptyState.description} action={emptyAction} />
        ) : layoutMode === "table" ? (
          <div className="ptable-wrap">
            <table className="projects">
              <thead>
                <tr>
                  <th {...sortHeaderProps("name")}>이름<span className="chev">▾</span></th>
                  <th {...sortHeaderProps("gate", "center")}>게이트<span className="chev">▾</span></th>
                  <th {...sortHeaderProps("critical", "num")}>크리티컬<span className="chev">▾</span></th>
                  <th {...sortHeaderProps("high", "num")}>하이<span className="chev">▾</span></th>
                  <th {...sortHeaderProps("medium", "num")}>미디엄<span className="chev">▾</span></th>
                  <th {...sortHeaderProps("open", "num")}>오픈<span className="chev">▾</span></th>
                  <th {...sortHeaderProps("approvals", "num")}>승인대기<span className="chev">▾</span></th>
                  <th {...sortHeaderProps("recent")}>마지막 분석<span className="chev">▾</span></th>
                  <th>담당</th>
                </tr>
              </thead>
              <tbody>
                {displayProjects.map((project) => {
                  const gate = gateLabel(project);
                  const critical = project.severitySummary?.critical ?? 0;
                  const high = project.severitySummary?.high ?? 0;
                  const medium = project.severitySummary?.medium ?? 0;
                  const open = totalFindings(project);
                  const approvals = projectPendingApprovals(project);
                  const owner = projectOwner(project);
                  const running = projectIsRunning(project);
                  return (
                    <tr
                      key={project.id}
                      className={running ? "running" : undefined}
                      role="link"
                      tabIndex={0}
                      aria-label={`${project.name} 프로젝트 열기`}
                      onClick={() => handleRowActivate(project.id)}
                      onKeyDown={(event) => handleRowKeyDown(event, project.id)}
                    >
                      <td>
                        <div className="cell-name">
                          <span className={`n ${running ? "running" : ""}`}>{project.name}</span>
                          <span className="slug">{project.description}</span>
                        </div>
                      </td>
                      <td className="center-cell"><span className={`cell-gate ${gate.cls}`}>{gate.txt}</span></td>
                      <td className="num-cell"><span className="crit">{critical || "·"}</span></td>
                      <td className="num-cell"><span className="high">{high || "·"}</span></td>
                      <td className="num-cell"><span className="med">{medium || "·"}</span></td>
                      <td className="num-cell">{open || "·"}</td>
                      <td className="num-cell">{approvals > 0 ? <span className="approvals-pill">{approvals}</span> : <span className="approvals-pill zero">·</span>}</td>
                      <td className="cell-when">{projectDisplayWhen(project)}</td>
                      <td>
                        <div className="cell-owner">
                          <span className="mini-avatar">{owner.avatar}</span>
                          <span>{owner.name}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ProjectCards projects={displayProjects} />
        )}
      </div>
    </section>
  );
};
