import React from "react";

export const GeneralSettingsSection: React.FC = () => (
  <div className="project-settings-stack">
    <div className="panel project-settings-card">
      <div className="panel-body project-settings-card__body">
        <div className="project-settings-section-header">
          <span className="project-settings-section-header__accent" />
          <div>
            <h3 className="panel-title project-settings-section-header__title">
              일반
            </h3>
            <p className="project-settings-section-header__desc">
              프로젝트 이름과 설명처럼 가장 기본적인 운영 정보를 관리합니다.
            </p>
          </div>
        </div>

        <div className="project-settings-form-grid">
          <div className="project-settings-field">
            <label className="form-label project-settings-field__label">
              프로젝트 이름
            </label>
            <div className="project-settings-field__row">
              <input className="form-input project-settings-field__control"
                type="text"
                placeholder="프로젝트 이름"
              />
              <button type="button" className="btn btn-primary btn-sm">저장</button>
            </div>
          </div>

          <div className="project-settings-field">
            <label className="form-label project-settings-field__label">설명</label>
            <div className="project-settings-field__row project-settings-field__row--textarea">
              <textarea className="form-textarea project-settings-field__control project-settings-field__textarea"
                placeholder="프로젝트 설명"
                rows={3}
              />
              <button type="button" className="btn btn-primary btn-sm">저장</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
