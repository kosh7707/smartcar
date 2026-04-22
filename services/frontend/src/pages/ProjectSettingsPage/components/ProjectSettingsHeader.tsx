import React from "react";
import { PageHeader } from "../../../shared/ui";
import type { Project } from "@aegis/shared";

interface ProjectSettingsHeaderProps {
  project: Project | null;
  projectId?: string;
  sdkCount: number;
  dirty: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

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
  onCancel,
  onSave,
}) => {
  const action = dirty ? (
    <div className="ps-change-bar" role="group" aria-label="변경사항 제어">
      <span className="ps-change-bar__dot" aria-hidden="true" />
      <span className="ps-change-bar__label">unsaved · general</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
        취소
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  ) : null;

  const id = shortId(projectId);
  const created = formatShortDate(project?.createdAt);
  const updated = formatShortDate(project?.updatedAt);

  const metaParts: string[] = [];
  if (project?.name) metaParts.push(project.name);
  if (id) metaParts.push(`id · ${id}`);
  if (created) metaParts.push(`created ${created}`);
  if (updated) metaParts.push(`updated ${updated}`);
  metaParts.push(`sdks · ${sdkCount}`);

  return (
    <>
      <PageHeader surface="plain" title="프로젝트 설정" action={action} />
      {metaParts.length > 0 ? (
        <p className="page-meta-inline" aria-label="프로젝트 메타데이터">
          {metaParts.map((part, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 ? <span aria-hidden="true">·</span> : null}
              <span>{part}</span>
            </React.Fragment>
          ))}
        </p>
      ) : null}
    </>
  );
};
