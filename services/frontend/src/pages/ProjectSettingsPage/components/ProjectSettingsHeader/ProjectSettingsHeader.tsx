import "./ProjectSettingsHeader.css";
import React from "react";
import type { Project } from "@aegis/shared";
import { ProjectSettingsTabStrip, type SettingsSection } from "../ProjectSettingsTabStrip/ProjectSettingsTabStrip";

interface ProjectSettingsHeaderProps {
  project: Project | null;
  projectId?: string;
  sdkCount: number;
  dirty: boolean;
  saving: boolean;
  activeSection: SettingsSection;
  onCancel: () => void;
  onSave: () => void;
  onSelectSection: (section: SettingsSection) => void;
}

const SECTION_LABEL: Record<SettingsSection, string> = {
  "general": "일반",
  "sdk": "SDK",
  "build-targets": "빌드 타겟",
  "notifications": "알림",
  "adapters": "어댑터",
  "danger": "위험 구역",
};

function formatShortDate(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function shortId(id?: string): string | null {
  if (!id) return null;
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-2)}`;
}

export const ProjectSettingsHeader: React.FC<ProjectSettingsHeaderProps> = ({
  project,
  projectId,
  sdkCount,
  dirty,
  saving,
  activeSection,
  onCancel,
  onSave,
  onSelectSection,
}) => {
  const id = shortId(projectId);
  const created = formatShortDate(project?.createdAt);
  const updated = formatShortDate(project?.updatedAt);

  type MetaItem = { key: string; value: string; mono?: boolean };
  const meta: MetaItem[] = [];
  if (id) meta.push({ key: "id", value: id, mono: true });
  if (created) meta.push({ key: "created", value: created });
  if (updated) meta.push({ key: "updated", value: updated });
  meta.push({ key: "sdks", value: String(sdkCount) });

  const projectName = project?.name?.trim() || "프로젝트";

  return (
    <header className="page-header page-header--plain ps-page-head">
      <div className="ps-ph-top">
        <div className="ps-ph-title">
          <div className="ps-crumb" aria-hidden="true">
            <span>{projectName}</span>
            <span className="ps-crumb__sep">/</span>
            <span>설정</span>
          </div>
          <h1 className="page-header__title">프로젝트 설정</h1>
          {meta.length > 0 ? (
            <p className="ps-ph-meta" aria-label="프로젝트 메타데이터">
              {meta.map((item, idx) => (
                <span key={idx} className="ps-ph-meta__item">
                  <b>{item.key}</b>
                  <span className={item.mono ? "ps-ph-meta__value mono" : "ps-ph-meta__value"}>
                    {item.value}
                  </span>
                </span>
              ))}
            </p>
          ) : null}
        </div>
        {dirty ? (
          <div className="ps-change-bar" role="group" aria-label="변경사항 제어">
            <span className="ps-change-bar__dot" aria-hidden="true" />
            <span className="ps-change-bar__label">unsaved · {SECTION_LABEL[activeSection]}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
              취소
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        ) : null}
      </div>

      <ProjectSettingsTabStrip active={activeSection} onSelect={onSelectSection} />
    </header>
  );
};
