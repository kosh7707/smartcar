import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Calendar } from "lucide-react";
import { useProjects } from "../contexts/ProjectContext";
import { PageHeader, EmptyState } from "../components/ui";
import { formatDate } from "../utils/format";
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
          <label className="form-field" style={{ marginBottom: "var(--space-3)" }}>
            <span className="form-label">프로젝트명</span>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="프로젝트 이름을 입력하세요"
              autoFocus
            />
          </label>
          <label className="form-field" style={{ marginBottom: "var(--space-4)" }}>
            <span className="form-label">설명</span>
            <input
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="프로젝트 설명 (선택)"
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
                <div className="project-card__dates">
                  <span className="project-card__date">
                    <Calendar size={12} />
                    {formatDate(p.createdAt)}
                  </span>
                  <span className="project-card__date project-card__date--updated">
                    수정 {formatDate(p.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
