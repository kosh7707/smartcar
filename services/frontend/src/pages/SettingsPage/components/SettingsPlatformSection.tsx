import React from "react";
import { Info } from "lucide-react";

export function SettingsPlatformSection() {
  return (
    <div className="panel settings-platform-card">
      <div className="panel-head settings-platform-card__head">
        <div className="settings-platform-card__title-row">
          <div className="settings-platform-card__icon-shell">
            <Info size={20} />
          </div>
          <h3 className="panel-title settings-platform-card__title">플랫폼 정보</h3>
        </div>
      </div>
      <div className="panel-body settings-platform-card__body">
        <div className="settings-platform-card__row">
          <span className="settings-platform-card__label">Platform</span>
          <span className="settings-platform-card__value">AEGIS</span>
        </div>
        <div className="settings-platform-card__row">
          <span className="settings-platform-card__label">Version</span>
          <span className="settings-platform-card__version">
            <code>v{__APP_VERSION__}</code>
          </span>
        </div>
        <div className="settings-platform-card__row">
          <span className="settings-platform-card__label">License</span>
          <span className="settings-platform-card__license">
            Enterprise
          </span>
        </div>
        <div className="settings-platform-card__row">
          <span className="settings-platform-card__label">Framework</span>
          <span className="settings-platform-card__value">AEGIS</span>
        </div>
      </div>
    </div>
  );
}
