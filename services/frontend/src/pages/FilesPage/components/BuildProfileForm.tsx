import React, { useState, useCallback } from "react";
import type { BuildProfile } from "@aegis/shared";
import { ChevronRight, Settings } from "lucide-react";
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

  const handleSdkChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const sdkId = e.target.value;
    if (sdkId === "none") {
      onChange({ ...NONE_DEFAULTS });
      return;
    }
    const sdk = readySdks.find((s) => s.id === sdkId);
    if (sdk?.profile) {
      onChange({ sdkId, compiler: sdk.profile.compiler || "gcc", targetArch: sdk.profile.targetArch || "x86_64", languageStandard: sdk.profile.languageStandard || "c17", headerLanguage: "auto", includePaths: sdk.profile.includePaths });
    } else {
      onChange({ ...value, sdkId });
    }
  }, [value, onChange, readySdks]);

  const update = useCallback((field: keyof BuildProfile, val: string) => onChange({ ...value, [field]: val }), [value, onChange]);
  const handleIncludePathsChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const paths = e.target.value.split("\n").filter((l) => l.trim());
    onChange({ ...value, includePaths: paths.length > 0 ? paths : undefined });
  }, [value, onChange]);
  const handleDefinesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value.split("\n").filter((l) => l.trim());
    const defines: Record<string, string> = {};
    for (const line of lines) {
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0) defines[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
      else defines[line.trim()] = "";
    }
    onChange({ ...value, defines: Object.keys(defines).length > 0 ? defines : undefined });
  }, [value, onChange]);
  const handleFlagsChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const flags = e.target.value.split(/\s+/).filter((f) => f);
    onChange({ ...value, flags: flags.length > 0 ? flags : undefined });
  }, [value, onChange]);

  const currentSdk = readySdks.find((s) => s.id === value.sdkId);
  const selectClassName = "build-profile-select";

  return (
    <div className="build-profile-form">
      <label className="form-label build-profile-field">
        <span className="build-profile-field__label">SDK 프로파일</span>
        <select className={selectClassName} value={value.sdkId} onChange={handleSdkChange}>
          <option value="none">사용 안함</option>
          {readySdks.map((sdk) => <option key={sdk.id} value={sdk.id}>{sdk.name}</option>)}
        </select>
      </label>

      {value.sdkId === "none" && readySdks.length === 0 ? <div className="build-profile-note">등록된 SDK가 없습니다. 프로젝트 설정에서 SDK를 먼저 등록하세요.</div> : null}
      {currentSdk?.description ? <div className="build-profile-note">{currentSdk.description}</div> : null}

      <button type="button" className="btn btn-ghost btn-sm build-profile-toggle" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(!showAdvanced)}>
        <ChevronRight size={14} className={cn("build-profile-toggle__chevron", showAdvanced && "is-open")} />
        <Settings size={14} /> 상세 설정
      </button>

      {showAdvanced ? (
        <div className="build-profile-advanced">
          <div className="build-profile-grid">
            <label className="form-label build-profile-field"><span className="build-profile-field__label">컴파일러</span><input className="form-input build-profile-input" value={value.compiler} onChange={(e) => update("compiler", e.target.value)} placeholder="gcc" spellCheck={false} /></label>
            <label className="form-label build-profile-field"><span className="build-profile-field__label">컴파일러 버전</span><input className="form-input build-profile-input" value={value.compilerVersion ?? ""} onChange={(e) => onChange({ ...value, compilerVersion: e.target.value || undefined })} placeholder="(선택)" spellCheck={false} /></label>
            <label className="form-label build-profile-field"><span className="build-profile-field__label">타겟 아키텍처</span><input className="form-input build-profile-input" value={value.targetArch} onChange={(e) => update("targetArch", e.target.value)} placeholder="aarch64" spellCheck={false} /></label>
            <label className="form-label build-profile-field"><span className="build-profile-field__label">언어 표준</span><input className="form-input build-profile-input" value={value.languageStandard} onChange={(e) => update("languageStandard", e.target.value)} placeholder="c11" spellCheck={false} /></label>
            <label className="form-label build-profile-field"><span className="build-profile-field__label">헤더 처리 (.h)</span><select className={selectClassName} value={value.headerLanguage} onChange={(e) => update("headerLanguage", e.target.value)}><option value="auto">자동 감지</option><option value="c">C</option><option value="cpp">C++</option></select></label>
          </div>

          <label className="form-label build-profile-field"><span className="build-profile-field__label">인클루드 경로 (한 줄에 하나)</span><textarea className="form-textarea build-profile-input" value={(value.includePaths ?? []).join("\n")} onChange={handleIncludePathsChange} placeholder="../common-lib/include" rows={3} spellCheck={false} /></label>
          <label className="form-label build-profile-field"><span className="build-profile-field__label">전처리기 매크로 (KEY=VALUE, 한 줄에 하나)</span><textarea className="form-textarea build-profile-input" value={value.defines ? Object.entries(value.defines).map(([k, v]) => (v ? `${k}=${v}` : k)).join("\n") : ""} onChange={handleDefinesChange} placeholder="NDEBUG=1" rows={2} spellCheck={false} /></label>
          <label className="form-label build-profile-field"><span className="build-profile-field__label">추가 컴파일 플래그 (공백 구분)</span><textarea className="form-textarea build-profile-input" value={(value.flags ?? []).join(" ")} onChange={handleFlagsChange} placeholder="-Wall -Wextra" rows={2} spellCheck={false} /></label>
        </div>
      ) : null}
    </div>
  );
};
