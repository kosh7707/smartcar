import React, { useCallback, useState } from "react";
import { Copy, Users } from "lucide-react";

interface GeneralSettingsSectionProps {
  projectId?: string;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

function shortProjectId(id?: string): string | null {
  if (!id) return null;
  if (id.length <= 14) return id;
  return `${id.slice(0, 10)}…${id.slice(-2)}`;
}

export const GeneralSettingsSection: React.FC<GeneralSettingsSectionProps> = ({
  projectId,
  name,
  description,
  onNameChange,
  onDescriptionChange,
}) => {
  const [copied, setCopied] = useState(false);
  const idDisplay = shortProjectId(projectId);

  const handleCopy = useCallback(() => {
    if (!projectId) return;
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(projectId).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }).catch(() => undefined);
    }
  }, [projectId]);

  return (
    <section className="ps-section" data-pane="general" role="tabpanel" aria-label="일반">
      <div className="ps-section-head">
        <div>
          <h2 className="ps-section-head__title">일반</h2>
          <p className="ps-section-head__desc">
            프로젝트의 공식 이름과 팀 내부 요약. 이곳의 변경은 보고서, 승인 큐, 활동 피드에 즉시 반영됩니다.
          </p>
        </div>
      </div>

      <div className="panel ps-card">
        <div className="panel-body ps-card-body">
          <div className="ps-form-row">
            <label className="form-field" htmlFor="ps-general-name">
              <span className="form-label form-label--required">프로젝트 이름</span>
              <input
                id="ps-general-name"
                className="form-input"
                type="text"
                placeholder="프로젝트 이름"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="form-hint">analyst 협업과 보고서에 표시되는 공식 명칭.</p>
            </label>

            <label className="form-field" htmlFor="ps-general-desc">
              <span className="form-label">설명</span>
              <textarea
                id="ps-general-desc"
                className="form-textarea"
                placeholder="프로젝트 설명"
                rows={3}
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                spellCheck={false}
              />
              <p className="form-hint">팀원들이 프로젝트 목적을 빠르게 파악할 수 있는 1–2줄 요약.</p>
            </label>

            <div className="ps-form-grid-2">
              <div className="form-field">
                <span className="form-label">프로젝트 ID</span>
                <div className="ps-id-row">
                  <code className="ps-chip-code" aria-label={projectId ?? "프로젝트 ID 없음"}>
                    {idDisplay ?? "—"}
                  </code>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon-sm"
                    title={copied ? "복사됨" : "ID 복사"}
                    aria-label="프로젝트 ID 복사"
                    onClick={handleCopy}
                    disabled={!projectId}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div className="form-field">
                <span className="form-label">가시성</span>
                <div className="ps-visibility">
                  <Users size={14} aria-hidden="true" />
                  <span>internal · 팀 전체 공유</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
