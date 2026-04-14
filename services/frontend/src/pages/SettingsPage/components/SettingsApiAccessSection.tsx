import React from "react";
import { Settings } from "lucide-react";
import type { TestStatus } from "../hooks/useSettingsPage";

function getStatusLabel(testStatus: TestStatus) {
  if (testStatus === "ok") return "Connected";
  if (testStatus === "error") return "Error";
  return "—";
}

export function SettingsApiAccessSection({ url, testStatus }: { url: string; testStatus: TestStatus }) {
  return (
    <section className="gs-section gs-section--surface gs-section--api gs-bento__col-5">
      <div className="gs-section__header">
        <div className="gs-section__icon"><Settings size={20} /></div>
        <h3 className="gs-section__title">API Access</h3>
      </div>
      <div className="gs-info-table">
        <div className="gs-info-row">
          <span className="gs-info-label">Endpoint</span>
          <span className="gs-api-endpoint">{url || "http://localhost:3000"}/api/v1</span>
        </div>
        <div className="gs-info-row">
          <span className="gs-info-label">Status</span>
          <span className={`gs-info-value gs-info-value--status gs-info-value--status-${testStatus}`}>
            {getStatusLabel(testStatus)}
          </span>
        </div>
      </div>
    </section>
  );
}
