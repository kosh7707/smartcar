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
    <Card className="border-border/70 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
            <Server size={20} />
          </div>
          <CardTitle className="text-lg">백엔드 연결</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <Label className="form-field gap-2" htmlFor="backend-url">
          <span className="form-label">API 서버 주소</span>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Input
                id="backend-url"
                type="text"
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                placeholder="http://localhost:3000"
                spellCheck={false}
                className="pr-10 font-mono text-sm"
              />
              {testStatus === "ok" && (
                <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-emerald-500 p-1 text-white">
                  <Check size={12} />
                </span>
              )}
              {testStatus === "error" && (
                <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-destructive p-1 text-white">
                  <X size={12} />
                </span>
              )}
              {testStatus === "testing" && (
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-primary">
                  <Spinner size={12} />
                </span>
              )}
            </div>
            <div className="flex gap-2">
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
        {testStatus !== "idle" && testStatus !== "testing" && (
          <div
            className={cn(
              "rounded-lg border px-4 py-3 font-mono text-sm",
              testStatus === "ok" &&
                "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              testStatus === "error" &&
                "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {testStatus === "ok" ? `연결 성공 — ${testDetail}` : testDetail}
          </div>
        )}
        <div>
          <Button variant="link" className="px-0 text-muted-foreground" onClick={onReset}>
            기본값으로 초기화
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
