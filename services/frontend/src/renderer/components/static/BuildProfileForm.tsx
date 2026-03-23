import React, { useState, useCallback } from "react";
import type { BuildProfile } from "@aegis/shared";
import { ChevronRight, Settings } from "lucide-react";
import { SDK_PROFILES, getSdkProfile } from "../../constants/sdkProfiles";

interface Props {
  value: BuildProfile;
  onChange: (bp: BuildProfile) => void;
}

export const BuildProfileForm: React.FC<Props> = ({ value, onChange }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSdkChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const sdkId = e.target.value;
      const profile = getSdkProfile(sdkId);
      if (profile) {
        onChange({ ...profile.defaults, sdkId });
      } else {
        onChange({ ...value, sdkId });
      }
    },
    [value, onChange],
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

  const currentSdk = getSdkProfile(value.sdkId);

  return (
    <div className="bp-form">
      {/* SDK selector */}
      <label className="form-field">
        <span className="form-label">SDK 프로파일</span>
        <select
          className="form-input"
          value={value.sdkId}
          onChange={handleSdkChange}
        >
          {SDK_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.vendor !== "-" ? `(${p.vendor})` : ""}
            </option>
          ))}
        </select>
      </label>

      {currentSdk && currentSdk.id !== "custom" && (
        <div className="bp-sdk-hint">{currentSdk.description}</div>
      )}

      {/* Advanced toggle */}
      <button
        type="button"
        className="bp-advanced-toggle"
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <ChevronRight
          size={14}
          className={showAdvanced ? "ftree-chevron--open" : ""}
          style={{ transition: "transform 0.15s" }}
        />
        <Settings size={14} />
        상세 설정
      </button>

      {showAdvanced && (
        <div className="bp-advanced">
          <div className="bp-grid">
            <label className="form-field">
              <span className="form-label">컴파일러</span>
              <input
                className="form-input font-mono"
                value={value.compiler}
                onChange={(e) => update("compiler", e.target.value)}
                placeholder="gcc"
                spellCheck={false}
              />
            </label>
            <label className="form-field">
              <span className="form-label">컴파일러 버전</span>
              <input
                className="form-input font-mono"
                value={value.compilerVersion ?? ""}
                onChange={(e) => onChange({ ...value, compilerVersion: e.target.value || undefined })}
                placeholder="(선택)"
                spellCheck={false}
              />
            </label>
            <label className="form-field">
              <span className="form-label">타겟 아키텍처</span>
              <input
                className="form-input font-mono"
                value={value.targetArch}
                onChange={(e) => update("targetArch", e.target.value)}
                placeholder="aarch64"
                spellCheck={false}
              />
            </label>
            <label className="form-field">
              <span className="form-label">언어 표준</span>
              <input
                className="form-input font-mono"
                value={value.languageStandard}
                onChange={(e) => update("languageStandard", e.target.value)}
                placeholder="c11"
                spellCheck={false}
              />
            </label>
            <label className="form-field">
              <span className="form-label">헤더 처리 (.h)</span>
              <select
                className="form-input"
                value={value.headerLanguage}
                onChange={(e) => update("headerLanguage", e.target.value)}
              >
                <option value="auto">자동 감지</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
              </select>
            </label>
          </div>

          <label className="form-field">
            <span className="form-label">인클루드 경로 (한 줄에 하나)</span>
            <textarea
              className="form-input font-mono bp-textarea"
              value={(value.includePaths ?? []).join("\n")}
              onChange={handleIncludePathsChange}
              placeholder="../common-lib/include"
              rows={3}
              spellCheck={false}
            />
          </label>

          <label className="form-field">
            <span className="form-label">전처리기 매크로 (KEY=VALUE, 한 줄에 하나)</span>
            <textarea
              className="form-input font-mono bp-textarea"
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
          </label>

          <label className="form-field">
            <span className="form-label">추가 컴파일 플래그 (공백 구분)</span>
            <textarea
              className="form-input font-mono bp-textarea"
              value={(value.flags ?? []).join(" ")}
              onChange={handleFlagsChange}
              placeholder="-Wall -Wextra"
              rows={2}
              spellCheck={false}
            />
          </label>
        </div>
      )}
    </div>
  );
};
