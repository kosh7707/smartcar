import React, { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
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

function isStale(project: DashboardProject): boolean {
  if (!project.lastAnalysisAt) return true;
  const ageDays = (Date.now() - new Date(project.lastAnalysisAt).getTime()) / 86_400_000;
  return ageDays >= 7;
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
    switch (statusFilter) {
      case "blocked":
        return projects.filter((project) => project.gateStatus === "fail");
      case "running":
        return projects.filter(projectIsRunning);
      case "stale":
        return projects.filter(isStale);
      default:
        return projects;
    }
  }, [projects, statusFilter]);

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
                  <th>프로젝트</th>
                  <th className="center">게이트</th>
                  <th className="num">크리티컬</th>
                  <th className="num">하이</th>
                  <th className="num">미디엄</th>
                  <th className="num">오픈</th>
                  <th className="num">승인대기</th>
                  <th>마지막 분석</th>
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

      <div className="panel-foot"><span>{displayProjects.length} / {projects.length} 프로젝트 표시</span><a href="#" onClick={(event) => event.preventDefault()}>전체 보기 →</a></div>
    </section>
  );
};
