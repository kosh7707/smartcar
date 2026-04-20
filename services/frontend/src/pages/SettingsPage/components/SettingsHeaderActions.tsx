import React from "react";
import { Button } from "@/components/ui/button";

type SettingsHeaderActionsProps = { saved: boolean; urlDirty: boolean; onReset: () => void; onSave: () => void; };

export function SettingsHeaderActions({ saved, urlDirty, onReset, onSave }: SettingsHeaderActionsProps) {
  return (
    <div className="gs-page-header__actions">
      <Button variant="outline" onClick={onReset}>초기화</Button>
      <Button onClick={onSave} disabled={!urlDirty && !saved}>{saved ? "저장됨" : "변경 저장"}</Button>
    </div>
  );
}
