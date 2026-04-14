import React, { useState, useCallback, useEffect } from "react";
import type { BuildTarget } from "@aegis/shared";
import { Check, Play } from "lucide-react";
import "./TargetSelectDialog.css";

interface Props {
  open: boolean;
  targets: BuildTarget[];
  onConfirm: (selectedTargetId: string) => void;
  onCancel: () => void;
}

export const TargetSelectDialog: React.FC<Props> = ({ open, targets, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState<string | null>(null);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelected(targets[0]?.id ?? null);
    }
  }, [open, targets]);

  const chooseTarget = useCallback((id: string) => {
    setSelected(id);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selected) onConfirm(selected);
  }, [selected, onConfirm]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="card tsd" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog__title">분석 대상 선택</h3>
        <p className="confirm-dialog__message">Quick/Deep 분석을 실행할 BuildTarget 하나를 선택하세요.</p>

        <div className="tsd__body">
          {targets.map((t) => {
            const isSelected = selected === t.id;
            const sdkLabel = t.buildProfile.sdkId === "none" ? null : t.buildProfile.sdkId;
            return (
              <div
                key={t.id}
                className={`tsd__row${isSelected ? " tsd__row--selected" : ""}`}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => chooseTarget(t.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseTarget(t.id); } }}
              >
                <div className={`tsd__check${isSelected ? " tsd__check--active" : ""}`}>
                  {isSelected && <Check size={12} />}
                </div>
                <div className="tsd__info">
                  <div className="tsd__name">{t.name}</div>
                  <div className="tsd__path">{t.relativePath}</div>
                </div>
                {sdkLabel && <span className="tsd__sdk">{sdkLabel}</span>}
              </div>
            );
          })}
        </div>

        <div className="tsd__actions">
          <button className="btn btn-secondary" onClick={onCancel}>취소</button>
          <button
            className="btn"
            onClick={handleConfirm}
            disabled={!selected}
          >
            <Play size={14} />
            분석 실행
          </button>
        </div>
      </div>
    </div>
  );
};
