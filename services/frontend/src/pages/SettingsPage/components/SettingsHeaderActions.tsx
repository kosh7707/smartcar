import React from "react";

type SettingsHeaderActionsProps = {
  saved: boolean;
  urlDirty: boolean;
  onReset: () => void;
  onSave: () => void;
};

export function SettingsHeaderActions({ saved, urlDirty, onReset, onSave }: SettingsHeaderActionsProps) {
  return (
    <div className="gs-page-header__actions">
      <button className="btn btn-secondary" onClick={onReset}>초기화</button>
      <button className="btn" onClick={onSave} disabled={!urlDirty && !saved}>
        {saved ? "저장됨" : "변경 저장"}
      </button>
    </div>
  );
}
