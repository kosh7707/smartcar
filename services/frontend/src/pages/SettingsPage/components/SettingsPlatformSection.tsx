import React from "react";
import { Info } from "lucide-react";

export function SettingsPlatformSection() {
  return (
    <section className="gs-section gs-section--surface gs-bento__col-4">
      <div className="gs-section__header">
        <div className="gs-section__icon"><Info size={20} /></div>
        <h3 className="gs-section__title">Platform Information</h3>
      </div>
      <div className="gs-info-table">
        <div className="gs-info-row">
          <span className="gs-info-label">Platform</span>
          <span className="gs-info-value">AEGIS</span>
        </div>
        <div className="gs-info-row">
          <span className="gs-info-label">Version</span>
          <span className="gs-info-value gs-info-value--mono"><code>v{__APP_VERSION__}</code></span>
        </div>
        <div className="gs-info-row">
          <span className="gs-info-label">License</span>
          <span className="gs-info-value gs-info-value--accent">Enterprise</span>
        </div>
        <div className="gs-info-row">
          <span className="gs-info-label">Framework</span>
          <span className="gs-info-value">AEGIS</span>
        </div>
      </div>
    </section>
  );
}
