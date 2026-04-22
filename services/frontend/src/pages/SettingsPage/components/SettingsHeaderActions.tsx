import React from "react";

type SettingsHeaderActionsProps = { saved: boolean; urlDirty: boolean; onReset: () => void; onSave: () => void; };

export function SettingsHeaderActions({ saved, urlDirty, onReset, onSave }: SettingsHeaderActionsProps) {
  return (
    <div className="gs-page-header__actions">
      <button type="button" className="btn btn-outline" onClick={onReset}>초기화</button>
      <button type="button" className="btn btn-primary" onClick={onSave} disabled={!urlDirty && !saved}>{saved ? "저장됨" : "변경 저장"}</button>
    </div>
  );
}
