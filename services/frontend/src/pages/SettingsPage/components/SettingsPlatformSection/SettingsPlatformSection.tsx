import "./SettingsPlatformSection.css";
import React from "react";

export function SettingsPlatformSection() {
  return (
    <div className="settings-kv">
      <div className="settings-kv__row">
        <span className="settings-kv__key">Platform</span>
        <span className="settings-kv__value">AEGIS</span>
      </div>
      <div className="settings-kv__row">
        <span className="settings-kv__key">Version</span>
        <span className="settings-kv__value">
          <span className="settings-kv__tag">v{__APP_VERSION__}</span>
        </span>
      </div>
      <div className="settings-kv__row">
        <span className="settings-kv__key">License</span>
        <span className="settings-kv__value">
          <span className="settings-kv__tag settings-kv__tag--accent">Enterprise</span>
        </span>
      </div>
    </div>
  );
}
