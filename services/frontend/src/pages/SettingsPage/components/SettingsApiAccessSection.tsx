import React from "react";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="settings-api-card">
      <CardHeader className="settings-api-card__head">
        <div className="settings-api-card__title-row">
          <div className="settings-api-card__icon-shell">
            <Settings size={20} />
          </div>
          <CardTitle className="settings-api-card__title">API 접근</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="settings-api-card__body">
        <div className="settings-api-card__surface">
          <div className="settings-api-card__surface-label">Endpoint</div>
          <div className="settings-api-card__endpoint">
            {url || "http://localhost:3000"}/api/v1
          </div>
        </div>
        <div className="settings-api-card__surface">
          <div className="settings-api-card__surface-label">Status</div>
          <Badge
            variant="outline"
            className={cn(
              "settings-api-card__status-badge",
              testStatus === "ok" && "settings-api-card__status-badge--ok",
              testStatus === "error" && "settings-api-card__status-badge--error",
              (testStatus === "idle" || testStatus === "testing") &&
                "settings-api-card__status-badge--idle",
            )}
          >
            {getStatusLabel(testStatus)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
