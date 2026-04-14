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
      <button className="btn btn-secondary" onClick={onReset}>Reset</button>
      <button className="btn" onClick={onSave} disabled={!urlDirty && !saved}>
        {saved ? "저장됨" : "Save Changes"}
      </button>
    </div>
  );
}
