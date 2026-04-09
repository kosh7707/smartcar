import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Shield, FolderKanban, ArrowRight, Plus } from "lucide-react";
import { useProjects } from "../contexts/ProjectContext";
import { formatRelativeTime } from "../utils/format";
import "./ProjectsPage.css";

type EventType = "analysis" | "gate_pass" | "gate_fail" | "vulnerability" | "approval" | "upload";
type ChipTone = "neutral" | "critical" | "high" | "medium" | "success" | "warning";

type DashboardProject = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  lastAnalysisAt?: string | null;
  gateStatus?: string | null;
  unresolvedDelta?: number;
  severitySummary?: { critical?: number; high?: number; medium?: number; low?: number } | null;
};

interface ActivityEvent {
  id: string;
  projectId: string;
  projectName: string;
  type: EventType;
  description: string;
  chips?: Array<{ label: string; tone: ChipTone }>;
  timestamp: string;
}

const EVENT_LABELS: Record<EventType, string> = {
  analysis: "Analysis",
  gate_pass: "Quality Gate",
  gate_fail: "Quality Gate",
  vulnerability: "Findings",
  approval: "Approval",
  upload: "Upload",
};

const EVENT_CSS: Record<EventType, string> = {
  analysis: "event--analysis",
  gate_pass: "event--success",
  gate_fail: "event--danger",
  vulnerability: "event--warning",
  approval: "event--info",
  upload: "event--neutral",
};

function totalFindings(project: DashboardProject): number {
  return (project.severitySummary?.critical ?? 0)
    + (project.severitySummary?.high ?? 0)
    + (project.severitySummary?.medium ?? 0)
    + (project.severitySummary?.low ?? 0);
}

function severityAccent(project: DashboardProject): string {
  const summary = project.severitySummary;
  if ((summary?.critical ?? 0) > 0) return "var(--aegis-severity-critical)";
  if ((summary?.high ?? 0) > 0) return "var(--aegis-severity-high)";
  if ((summary?.medium ?? 0) > 0) return "var(--aegis-severity-medium)";
  if (project.gateStatus === "pass") return "var(--cds-support-success)";
  return "var(--cds-text-placeholder)";
}

function gateTone(gateStatus?: string | null): "fail" | "warning" | null {
  if (gateStatus === "fail") return "fail";
  if (gateStatus === "warning") return "warning";
  return null;
}

function gateLabel(gateStatus?: string | null): string | null {
  if (gateStatus === "fail") return "Gate fail";
  if (gateStatus === "warning") return "Gate warning";
  return null;
}

function projectPriority(project: DashboardProject): number {
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const unresolved = project.unresolvedDelta ?? 0;
  const gatePenalty = project.gateStatus === "fail" ? 40 : project.gateStatus === "warning" ? 18 : 0;
  return critical * 100 + high * 20 + medium * 5 + unresolved + gatePenalty;
}

function buildProjectChips(project: DashboardProject): Array<{ label: string; tone: ChipTone }> {
  const chips: Array<{ label: string; tone: ChipTone }> = [];
  const total = totalFindings(project);
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const low = project.severitySummary?.low ?? 0;

  chips.push({ label: `Findings ${total}`, tone: total > 0 ? "neutral" : "success" });
  if (critical > 0) chips.push({ label: `Critical ${critical}`, tone: "critical" });
  if (high > 0) chips.push({ label: `High ${high}`, tone: "high" });
  if (medium > 0) chips.push({ label: `Medium ${medium}`, tone: "medium" });
  if (low > 0) chips.push({ label: `Low ${low}`, tone: "neutral" });
  if ((project.unresolvedDelta ?? 0) > 0) chips.push({ label: `Unresolved +${project.unresolvedDelta}`, tone: "warning" });

  return chips;
}

function buildActivity(projects: DashboardProject[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const project of projects) {
    const timestamp = project.lastAnalysisAt;

    if (timestamp) {
      events.push({
        id: `${project.id}-analysis`,
        projectId: project.id,
        projectName: project.name,
        type: "analysis",
        description: "정적 분석이 완료되었습니다",
        chips: buildProjectChips(project).slice(0, 5),
        timestamp,
      });
    }

    if (project.gateStatus === "fail" || project.gateStatus === "warning" || project.gateStatus === "pass") {
      events.push({
        id: `${project.id}-gate`,
        projectId: project.id,
        projectName: project.name,
        type: project.gateStatus === "fail" ? "gate_fail" : "gate_pass",
        description: project.gateStatus === "fail" ? "Quality Gate에 실패했습니다" : "Quality Gate를 통과했습니다",
        chips: buildProjectChips(project).slice(0, 3),
        timestamp: timestamp || project.updatedAt,
      });
    }

    const total = totalFindings(project);
    if (total > 0) {
      events.push({
        id: `${project.id}-vulnerability`,
        projectId: project.id,
        projectName: project.name,
        type: "vulnerability",
        description: `취약점 ${total}건이 발견되었습니다`,
        chips: buildProjectChips(project).slice(0, 5),
        timestamp: timestamp || project.updatedAt,
      });
    }
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function recentProjectUpdate(project: DashboardProject): string {
  const timestamp = project.lastAnalysisAt || project.updatedAt;
  return `recent update · ${formatRelativeTime(timestamp)}`;
}

export const ProjectsPage: React.FC = () => {
  const { projects, loading, createProject } = useProjects();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [visibleActivityCount, setVisibleActivityCount] = useState(10);

  useEffect(() => {
    document.title = "AEGIS — Dashboard";
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return projects;
    const query = filter.toLowerCase();
    return projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(query));
  }, [projects, filter]);

  const attentionProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => projectPriority(b) - projectPriority(a))
      .filter((project) => projectPriority(project) > 0)
      .slice(0, 4);
  }, [projects]);

  const nextMoveProject = attentionProjects[0] ?? filtered[0] ?? projects[0] ?? null;
  const activity = useMemo(() => buildActivity(projects), [projects]);
  const visibleActivity = useMemo(() => activity.slice(0, visibleActivityCount), [activity, visibleActivityCount]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const project = await createProject(name.trim(), desc.trim());
    setName("");
    setDesc("");
    setShowCreate(false);
    navigate(`/projects/${project.id}/overview`);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-body">
        <aside className="dashboard-explorer" aria-label="Project explorer">
          <div className="dashboard-section-heading">
            <h2 className="dashboard-section-heading__title">Project explorer</h2>
            <div className="dashboard-section-heading__actions">
              <button
                type="button"
                className="explorer-create-btn"
                onClick={() => setShowCreate((prev) => !prev)}
              >
                <Plus size={13} />
                <span>New</span>
              </button>
              <span className="dashboard-section-heading__count">{filtered.length}</span>
            </div>
          </div>

          <div className="dashboard-search">
            <Search size={14} className="dashboard-search__icon" />
            <input
              className="dashboard-search__input"
              type="text"
              placeholder="Search projects"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>

          {showCreate && (
            <div className="dashboard-create-inline">
              <input
                className="dashboard-create-inline__input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Project name"
                autoFocus
                onKeyDown={(event) => event.key === "Enter" && handleCreate()}
              />
              <input
                className="dashboard-create-inline__input"
                value={desc}
                onChange={(event) => setDesc(event.target.value)}
                placeholder="Description (optional)"
                onKeyDown={(event) => event.key === "Enter" && handleCreate()}
              />
              <div className="dashboard-create-inline__actions">
                <button
                  type="button"
                  className="dashboard-create-inline__btn dashboard-create-inline__btn--ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setName("");
                    setDesc("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dashboard-create-inline__btn dashboard-create-inline__btn--primary"
                  onClick={handleCreate}
                >
                  Create
                </button>
              </div>
            </div>
          )}

          <ul className="project-list">
            {filtered.map((project) => (
              <li key={project.id} className="project-list__item">
                <Link
                  to={`/projects/${project.id}/overview`}
                  className="project-row"
                  style={{ ["--project-accent" as string]: severityAccent(project) } as React.CSSProperties}
                >
                  <div className="project-row__body">
                    <div className="project-row__topline">
                      <span className="project-row__name" title={project.name}>{project.name}</span>
                    </div>
                    <div className="project-row__footer project-row__footer--compact">
                      <span className="project-row__time">{recentProjectUpdate(project)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}

            {!loading && filtered.length === 0 && <li className="project-list__empty">검색 조건에 맞는 프로젝트가 없습니다.</li>}
            {loading && projects.length === 0 && <li className="project-list__empty">프로젝트 목록을 불러오는 중입니다…</li>}
          </ul>
        </aside>

        <main className="dashboard-main">
          <div className="dashboard-main__lane">
            <section className="dashboard-section dashboard-section--attention">
              <div className="dashboard-section-heading">
                <h2 className="dashboard-section-heading__title">Needs attention</h2>
              </div>

              {attentionProjects.length === 0 ? (
                <div className="dashboard-empty-state dashboard-empty-state--attention">
                  <Shield size={24} />
                  <div>
                    <strong>No urgent items</strong>
                    {nextMoveProject ? (
                      <Link to={`/projects/${nextMoveProject.id}/overview`} className="dashboard-inline-link">
                        {nextMoveProject.name} 열기
                      </Link>
                    ) : (
                      <span className="dashboard-empty-state__hint">프로젝트를 먼저 생성하세요.</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="attention-shelf">
                  {attentionProjects.map((project) => {
                    const gate = gateTone(project.gateStatus);
                    const gateText = gateLabel(project.gateStatus);
                    const chips = buildProjectChips(project).slice(0, 4);

                    return (
                      <Link key={project.id} to={`/projects/${project.id}/overview`} className="attention-card">
                        <div className="attention-card__body">
                          <div className="attention-card__head">
                            <div className="attention-card__title-wrap">
                              <span className="attention-card__name">{project.name}</span>
                              {gate && gateText ? (
                                <span className={`attention-card__gate attention-card__gate--${gate}`}>{gateText}</span>
                              ) : null}
                            </div>
                            <span className="attention-card__time">{recentProjectUpdate(project)}</span>
                          </div>
                          <div className="attention-card__chips">
                            {chips.map((chip) => (
                              <span key={chip.label} className={`dashboard-chip dashboard-chip--${chip.tone}`}>
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="attention-card__aside">
                          <div className="attention-card__action">
                            <span>Open</span>
                            <ArrowRight size={14} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="dashboard-section dashboard-section--activity">
              <div className="dashboard-section-heading">
                <h2 className="dashboard-section-heading__title">Recent activity</h2>
              </div>

              {activity.length === 0 ? (
                <div className="dashboard-empty-state">
                  <FolderKanban size={24} />
                  <div>
                    <strong>No activity yet</strong>
                    <span className="dashboard-empty-state__hint">분석이 시작되면 이곳에 기록됩니다.</span>
                  </div>
                </div>
              ) : (
                <div className="activity-list activity-list--boxed">
                  {visibleActivity.map((event) => (
                    <div key={event.id} className={`activity-card ${EVENT_CSS[event.type]}`}>
                      <div className="activity-card__body">
                        <div className="activity-card__head">
                          <div className="activity-card__head-left">
                            <Link to={`/projects/${event.projectId}/overview`} className="activity-card__project">
                              {event.projectName}
                            </Link>
                            <span className={`activity-card__type activity-card__type--${event.type}`}>
                              {EVENT_LABELS[event.type]}
                            </span>
                          </div>
                          <span className="activity-card__time">{formatRelativeTime(event.timestamp)}</span>
                        </div>
                        <p className="activity-card__description">{event.description}</p>
                        {event.chips && event.chips.length > 0 ? (
                          <div className="activity-card__chips">
                            {event.chips.map((chip) => (
                              <span key={chip.label} className={`dashboard-chip dashboard-chip--${chip.tone} dashboard-chip--compact`}>
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="activity-card__aside">
                        <Link to={`/projects/${event.projectId}/overview`} className="activity-card__open">
                          <span>Open</span>
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activity.length > visibleActivityCount && (
                <div className="activity-more">
                  <button
                    type="button"
                    className="activity-more__btn"
                    onClick={() => setVisibleActivityCount((count) => count + 10)}
                  >
                    More
                  </button>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};
