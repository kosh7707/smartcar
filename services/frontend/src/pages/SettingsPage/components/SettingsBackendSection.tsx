import React from "react";
import { Check, Server, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Spinner } from "../../../shared/ui";
import type { TestStatus } from "../hooks/useSettingsPage";

type SettingsBackendSectionProps = {
  url: string;
  urlDirty: boolean;
  saved: boolean;
  testStatus: TestStatus;
  testDetail: string;
  onUrlChange: (value: string) => void;
  onTest: () => void;
  onSave: () => void;
  onReset: () => void;
};

export function SettingsBackendSection({
  url,
  urlDirty,
  saved,
  testStatus,
  testDetail,
  onUrlChange,
  onTest,
  onSave,
  onReset,
}: SettingsBackendSectionProps) {
  return (
    <Card className="settings-backend-card">
      <CardHeader className="settings-backend-card__head">
        <div className="settings-backend-card__title-row">
          <div className="settings-backend-card__icon-shell">
            <Server size={20} />
          </div>
          <CardTitle className="settings-backend-card__title">백엔드 연결</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="settings-backend-card__body">
        <Label className="settings-backend-card__field" htmlFor="backend-url">
          <span className="settings-backend-card__label">API 서버 주소</span>
          <div className="settings-backend-card__controls">
            <div className="settings-backend-card__input-wrap">
              <Input
                id="backend-url"
                type="text"
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                placeholder="http://localhost:3000"
                spellCheck={false}
                className="settings-backend-card__input"
              />
              {testStatus === "ok" ? (
                <span className="settings-backend-card__status-indicator settings-backend-card__status-indicator--ok">
                  <Check size={12} />
                </span>
              ) : null}
              {testStatus === "error" ? (
                <span className="settings-backend-card__status-indicator settings-backend-card__status-indicator--error">
                  <X size={12} />
                </span>
              ) : null}
              {testStatus === "testing" ? (
                <span className="settings-backend-card__status-indicator settings-backend-card__status-indicator--testing">
                  <Spinner size={12} />
                </span>
              ) : null}
            </div>
            <div className="settings-backend-card__actions">
              <Button
                variant="outline"
                size="sm"
                onClick={onTest}
                disabled={testStatus === "testing" || !url.trim()}
              >
                테스트
              </Button>
              <Button size="sm" onClick={onSave} disabled={!urlDirty && !saved}>
                {saved ? "저장됨" : "저장"}
              </Button>
            </div>
          </div>
        </Label>
        {testStatus !== "idle" && testStatus !== "testing" ? (
          <div
            className={cn(
              "settings-backend-card__status-message",
              testStatus === "ok" && "settings-backend-card__status-message--ok",
              testStatus === "error" && "settings-backend-card__status-message--error",
            )}
          >
            {testStatus === "ok" ? `연결 성공 — ${testDetail}` : testDetail}
          </div>
        ) : null}
        <div>
          <Button variant="link" className="settings-backend-card__reset" onClick={onReset}>
            기본값으로 초기화
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
