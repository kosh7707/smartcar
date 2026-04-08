import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Calendar, Pencil, ShieldAlert, ShieldCheck, ShieldX, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useProjects } from "../contexts/ProjectContext";
import { PageHeader, EmptyState, SeverityBar } from "../components/ui";
import { formatDate, formatDateTime } from "../utils/format";
import "./ProjectsPage.css";

export const ProjectsPage: React.FC = () => {
  const { projects, createProject } = useProjects();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const p = await createProject(name.trim(), description.trim());
    setName("");
    setDescription("");
    setShowCreate(false);
    navigate(`/projects/${p.id}/overview`);
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="프로젝트"
        icon={<FolderOpen size={20} />}
        action={
          <button className="btn" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            새 프로젝트
          </button>
        }
      />

      {showCreate && (
        <div className="card projects-create-form">
          <div className="card-title">새 프로젝트 생성</div>
          <label className="form-field" style={{ marginBottom: "var(--cds-spacing-04)" }}>
            <span className="form-label">프로젝트명</span>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="프로젝트 이름을 입력하세요"
              autoFocus
            />
          </label>
          <label className="form-field" style={{ marginBottom: "var(--cds-spacing-05)" }}>
            <span className="form-label">설명</span>
            <input
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: Engine ECU v2.3, AUTOSAR CP 기반"
            />
          </label>
          <div className="projects-create-form__actions">
            <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setName(""); setDescription(""); }}>취소</button>
            <button className="btn" onClick={handleCreate}>생성</button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={28} />}
          title="프로젝트가 없습니다"
          description="새 프로젝트를 생성하여 보안 분석을 시작하세요"
          action={<button className="btn" onClick={() => setShowCreate(true)}>프로젝트 생성</button>}
        />
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <div
              key={p.id}
              className="card project-card"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/projects/${p.id}/overview`)}
            >
              <div className="project-card__inner">
                <FolderOpen size={24} className="project-card__icon" />
                <div className="project-card__body">
                  <div className="project-card__name">{p.name}</div>
                  <div className="project-card__desc">{p.description || "설명 없음"}</div>
                </div>
                <div className="project-card__meta">
                  {p.severitySummary && (
                    <div className="project-card__severity">
                      <SeverityBar summary={{ ...p.severitySummary, info: 0 }} compact />
                    </div>
                  )}
                  <div className="project-card__indicators">
                    {p.gateStatus && (
                      <span className={`project-card__gate project-card__gate--${p.gateStatus}`} title={`Quality Gate: ${p.gateStatus === "pass" ? "통과" : p.gateStatus === "fail" ? "실패" : "보류"}`}>
                        {p.gateStatus === "pass" ? <ShieldCheck size={14} /> : p.gateStatus === "fail" ? <ShieldX size={14} /> : <ShieldAlert size={14} />}
                        <span className="project-card__gate-label">{p.gateStatus === "pass" ? "통과" : p.gateStatus === "fail" ? "실패" : "보류"}</span>
                      </span>
                    )}
                    {p.unresolvedDelta != null && p.unresolvedDelta !== 0 && (
                      <span
                        className={`project-card__delta ${p.unresolvedDelta > 0 ? "project-card__delta--up" : "project-card__delta--down"}`}
                        title={`미해결 Finding 변화: ${p.unresolvedDelta > 0 ? "+" : ""}${p.unresolvedDelta}`}
                      >
                        {p.unresolvedDelta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        미해결 {p.unresolvedDelta > 0 ? `+${p.unresolvedDelta}` : p.unresolvedDelta}
                      </span>
                    )}
                  </div>
                  <div className="project-card__dates">
                    {p.lastAnalysisAt ? (
                      <span className="project-card__date" title={`마지막 분석: ${formatDateTime(p.lastAnalysisAt)}`}>
                        <Calendar size={12} />
                        {formatDate(p.lastAnalysisAt)}
                      </span>
                    ) : (
                      <span className="project-card__date project-card__date--muted">분석 없음</span>
                    )}
                    <span className="project-card__date project-card__date--updated" style={{ fontFamily: 'var(--cds-font-mono)' }}>
                      <Pencil size={10} /> {formatDate(p.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
