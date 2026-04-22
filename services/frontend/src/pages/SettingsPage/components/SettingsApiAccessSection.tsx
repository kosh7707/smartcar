import React from "react";
import { cn } from "@/lib/utils";
import type { TestStatus } from "../hooks/useSettingsPage";

function getStatusLabel(testStatus: TestStatus) {
  if (testStatus === "ok") return "Connected";
  if (testStatus === "error") return "Error";
  if (testStatus === "testing") return "Testing";
  return "Idle";
}

function getStatusDotClass(testStatus: TestStatus) {
  if (testStatus === "ok") return "settings-kv__dot--ok";
  if (testStatus === "error") return "settings-kv__dot--error";
  if (testStatus === "testing") return "settings-kv__dot--testing";
  return "settings-kv__dot--idle";
}

export function SettingsApiAccessSection({
  url,
  testStatus,
}: {
  url: string;
  testStatus: TestStatus;
}) {
  const base = url.trim() || "http://localhost:3000";
  const endpoint = `${base.replace(/\/+$/, "")}/api/v1`;

  return (
    <div className="settings-kv">
      <div className="settings-kv__row">
        <span className="settings-kv__key">Endpoint</span>
        <span className="settings-kv__value settings-kv__value--mono">{endpoint}</span>
      </div>
      <div className="settings-kv__row">
        <span className="settings-kv__key">Status</span>
        <span className="settings-kv__value">
          <span className={cn("settings-kv__dot", getStatusDotClass(testStatus))} aria-hidden="true" />
          <span className="settings-kv__value--mono">{getStatusLabel(testStatus)}</span>
        </span>
      </div>
    </div>
  );
}
