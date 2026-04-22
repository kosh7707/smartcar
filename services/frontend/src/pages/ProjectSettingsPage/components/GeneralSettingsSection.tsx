import React from "react";

interface GeneralSettingsSectionProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export const GeneralSettingsSection: React.FC<GeneralSettingsSectionProps> = ({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}) => (
  <div className="ps-form">
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
  </div>
);
