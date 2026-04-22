import React from "react";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestStatus } from "../hooks/useSettingsPage";

function getStatusLabel(testStatus: TestStatus) {
  if (testStatus === "ok") return "Connected";
  if (testStatus === "error") return "Error";
  if (testStatus === "testing") return "Testing";
  return "Idle";
}

export function SettingsApiAccessSection({
  url,
  testStatus,
}: {
  url: string;
  testStatus: TestStatus;
}) {
  return (
    <div className="panel settings-api-card">
      <div className="panel-head settings-api-card__head">
        <div className="settings-api-card__title-row">
          <div className="settings-api-card__icon-shell">
            <Settings size={20} />
          </div>
          <h3 className="panel-title settings-api-card__title">API 접근</h3>
        </div>
      </div>
      <div className="panel-body settings-api-card__body">
        <div className="settings-api-card__surface">
          <div className="settings-api-card__surface-label">Endpoint</div>
          <div className="settings-api-card__endpoint">
            {url || "http://localhost:3000"}/api/v1
          </div>
        </div>
        <div className="settings-api-card__surface">
          <div className="settings-api-card__surface-label">Status</div>
          <span
            className={cn(
              "settings-api-card__status-badge",
              testStatus === "ok" && "settings-api-card__status-badge--ok",
              testStatus === "error" && "settings-api-card__status-badge--error",
              (testStatus === "idle" || testStatus === "testing") &&
                "settings-api-card__status-badge--idle",
            )}
          >
            {getStatusLabel(testStatus)}
          </span>
        </div>
      </div>
    </div>
  );
}
