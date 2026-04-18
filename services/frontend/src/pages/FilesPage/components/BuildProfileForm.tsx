import React, { useState, useCallback } from "react";
import type { BuildProfile } from "@aegis/shared";
import { ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RegisteredSdk } from "../../../api/sdk";

interface Props {
  value: BuildProfile;
  onChange: (bp: BuildProfile) => void;
  registeredSdks?: RegisteredSdk[];
}

const NONE_DEFAULTS: BuildProfile = {
  sdkId: "none",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c17",
  headerLanguage: "auto",
};

export const BuildProfileForm: React.FC<Props> = ({ value, onChange, registeredSdks }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const readySdks = (registeredSdks ?? []).filter((s) => s.status === "ready");

  const handleSdkChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const sdkId = e.target.value;
      if (sdkId === "none") {
        onChange({ ...NONE_DEFAULTS });
        return;
      }
      const sdk = readySdks.find((s) => s.id === sdkId);
      if (sdk?.profile) {
        onChange({
          sdkId,
          compiler: sdk.profile.compiler || "gcc",
          targetArch: sdk.profile.targetArch || "x86_64",
          languageStandard: sdk.profile.languageStandard || "c17",
          headerLanguage: "auto",
          includePaths: sdk.profile.includePaths,
        });
      } else {
        onChange({ ...value, sdkId });
      }
    },
    [value, onChange, readySdks],
  );

  const update = useCallback(
    (field: keyof BuildProfile, val: string) => {
      onChange({ ...value, [field]: val });
    },
    [value, onChange],
  );

  const handleIncludePathsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const paths = e.target.value.split("\n").filter((l) => l.trim());
      onChange({ ...value, includePaths: paths.length > 0 ? paths : undefined });
    },
    [value, onChange],
  );

  const handleDefinesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const lines = e.target.value.split("\n").filter((l) => l.trim());
      const defines: Record<string, string> = {};
      for (const line of lines) {
        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
          defines[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
        } else {
          defines[line.trim()] = "";
        }
      }
      onChange({ ...value, defines: Object.keys(defines).length > 0 ? defines : undefined });
    },
    [value, onChange],
  );

  const handleFlagsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const flags = e.target.value.split(/\s+/).filter((f) => f);
      onChange({ ...value, flags: flags.length > 0 ? flags : undefined });
    },
    [value, onChange],
  );

  const currentSdk = readySdks.find((s) => s.id === value.sdkId);
  const selectClassName = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="space-y-4">
      <Label className="flex flex-col items-start gap-2">
        <span className="text-sm font-medium text-foreground">SDK 프로파일</span>
        <select
          className={selectClassName}
          value={value.sdkId}
          onChange={handleSdkChange}
        >
          <option value="none">사용 안함</option>
          {readySdks.map((sdk) => (
            <option key={sdk.id} value={sdk.id}>
              {sdk.name}
            </option>
          ))}
        </select>
      </Label>

      {value.sdkId === "none" && readySdks.length === 0 && (
        <div className="text-xs text-muted-foreground">등록된 SDK가 없습니다. 프로젝트 설정에서 SDK를 먼저 등록하세요.</div>
      )}

      {currentSdk?.description && (
        <div className="text-xs text-muted-foreground">{currentSdk.description}</div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-start px-0 text-sm text-muted-foreground hover:text-foreground"
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <ChevronRight
          size={14}
          className={cn("transition-transform", showAdvanced && "rotate-90")}
        />
        <Settings size={14} />
        상세 설정
      </Button>

      {showAdvanced && (
        <div className="space-y-4 rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Label className="flex flex-col items-start gap-2">
              <span className="text-sm font-medium text-foreground">컴파일러</span>
              <Input
                className="font-mono"
                value={value.compiler}
                onChange={(e) => update("compiler", e.target.value)}
                placeholder="gcc"
                spellCheck={false}
              />
            </Label>
            <Label className="flex flex-col items-start gap-2">
              <span className="text-sm font-medium text-foreground">컴파일러 버전</span>
              <Input
                className="font-mono"
                value={value.compilerVersion ?? ""}
                onChange={(e) => onChange({ ...value, compilerVersion: e.target.value || undefined })}
                placeholder="(선택)"
                spellCheck={false}
              />
            </Label>
            <Label className="flex flex-col items-start gap-2">
              <span className="text-sm font-medium text-foreground">타겟 아키텍처</span>
              <Input
                className="font-mono"
                value={value.targetArch}
                onChange={(e) => update("targetArch", e.target.value)}
                placeholder="aarch64"
                spellCheck={false}
              />
            </Label>
            <Label className="flex flex-col items-start gap-2">
              <span className="text-sm font-medium text-foreground">언어 표준</span>
              <Input
                className="font-mono"
                value={value.languageStandard}
                onChange={(e) => update("languageStandard", e.target.value)}
                placeholder="c11"
                spellCheck={false}
              />
            </Label>
            <Label className="flex flex-col items-start gap-2">
              <span className="text-sm font-medium text-foreground">헤더 처리 (.h)</span>
              <select
                className={selectClassName}
                value={value.headerLanguage}
                onChange={(e) => update("headerLanguage", e.target.value)}
              >
                <option value="auto">자동 감지</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
              </select>
            </Label>
          </div>

          <Label className="flex flex-col items-start gap-2">
            <span className="text-sm font-medium text-foreground">인클루드 경로 (한 줄에 하나)</span>
            <Textarea
              className="min-h-12 font-mono text-xs"
              value={(value.includePaths ?? []).join("\n")}
              onChange={handleIncludePathsChange}
              placeholder="../common-lib/include"
              rows={3}
              spellCheck={false}
            />
          </Label>

          <Label className="flex flex-col items-start gap-2">
            <span className="text-sm font-medium text-foreground">전처리기 매크로 (KEY=VALUE, 한 줄에 하나)</span>
            <Textarea
              className="min-h-12 font-mono text-xs"
              value={
                value.defines
                  ? Object.entries(value.defines)
                      .map(([k, v]) => (v ? `${k}=${v}` : k))
                      .join("\n")
                  : ""
              }
              onChange={handleDefinesChange}
              placeholder="NDEBUG=1"
              rows={2}
              spellCheck={false}
            />
          </Label>

          <Label className="flex flex-col items-start gap-2">
            <span className="text-sm font-medium text-foreground">추가 컴파일 플래그 (공백 구분)</span>
            <Textarea
              className="min-h-12 font-mono text-xs"
              value={(value.flags ?? []).join(" ")}
              onChange={handleFlagsChange}
              placeholder="-Wall -Wextra"
              rows={2}
              spellCheck={false}
            />
          </Label>
        </div>
      )}
    </div>
  );
};
