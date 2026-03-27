import React, { useState, useCallback, useEffect } from "react";
import type { BuildTarget } from "@aegis/shared";
import { Check, Play } from "lucide-react";
import "./TargetSelectDialog.css";

interface Props {
  open: boolean;
  targets: BuildTarget[];
  onConfirm: (selectedTargetIds: string[]) => void;
  onCancel: () => void;
}

export const TargetSelectDialog: React.FC<Props> = ({ open, targets, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelected(new Set(targets.map((t) => t.id)));
    }
  }, [open, targets]);

  const toggleTarget = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === targets.length) return new Set();
      return new Set(targets.map((t) => t.id));
    });
  }, [targets]);

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selected));
  }, [selected, onConfirm]);

  if (!open) return null;

  const allSelected = selected.size === targets.length;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="card tsd" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog__title">분석 대상 선택</h3>
        <p className="confirm-dialog__message">분석할 빌드 타겟을 선택하세요.</p>

        <div className="tsd__body">
          {/* Select All */}
          <div
            className="tsd__select-all"
            role="checkbox"
            aria-checked={allSelected}
            tabIndex={0}
            onClick={toggleAll}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAll(); } }}
          >
            <div className={`tsd__check${allSelected ? " tsd__check--active" : ""}`}>
              {allSelected && <Check size={12} />}
            </div>
            전체 선택 ({targets.length}개)
          </div>

          {/* Target list */}
          {targets.map((t) => {
            const isSelected = selected.has(t.id);
            const sdkLabel = t.buildProfile.sdkId === "none" ? null : t.buildProfile.sdkId;
            return (
              <div
                key={t.id}
                className={`tsd__row${isSelected ? " tsd__row--selected" : ""}`}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => toggleTarget(t.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTarget(t.id); } }}
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
            disabled={selected.size === 0}
          >
            <Play size={14} />
            분석 실행 ({selected.size}개)
          </button>
        </div>
      </div>
    </div>
  );
};
