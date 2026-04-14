import React from "react";

export const GeneralSettingsSection: React.FC = () => (
  <div className="project-settings-stack">
    <div className="card project-settings-card">
      <div className="project-settings-section-header">
        <span className="project-settings-section-header__accent" />
        <div>
          <div className="card-title project-settings-section-header__title">General</div>
          <p className="project-settings-section-header__desc">프로젝트 이름과 설명처럼 가장 기본적인 운영 정보를 관리합니다.</p>
        </div>
      </div>

      <div className="project-settings-form-grid">
        <div className="project-settings-field">
          <label className="project-settings-field__label">프로젝트 이름</label>
          <div className="project-settings-field__row">
            <input className="input project-settings-field__control" type="text" placeholder="프로젝트 이름" />
            <button className="btn btn-sm">저장</button>
          </div>
        </div>

        <div className="project-settings-field">
          <label className="project-settings-field__label">설명</label>
          <div className="project-settings-field__row project-settings-field__row--textarea">
            <textarea
              className="input project-settings-field__control project-settings-field__textarea"
              placeholder="프로젝트 설명"
              rows={3}
            />
            <button className="btn btn-sm">저장</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
