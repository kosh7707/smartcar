import React from "react";
import type { AgentRecoveryTraceEntry } from "@aegis/shared";
import { cn } from "@/common/utils/cn";
import "./RecoveryTracePanel.css";

export interface RecoveryTracePanelProps {
  trace?: AgentRecoveryTraceEntry[];
  variant?: "compact" | "expanded";
  className?: string;
}

// ── Compact variant ──
// Shows first entry inline or a summary chip "복구 N회" when multiple entries exist.

function CompactPanel({ trace }: { trace: AgentRecoveryTraceEntry[] }) {
  if (trace.length === 1) {
    const entry = trace[0];
    const text =
      entry.action ?? entry.deficiency ?? entry.outcome ?? entry.detail;
    return (
      <span className="recovery-trace-compact">
        <span className="recovery-trace-compact__label">복구</span>
        {text && (
          <span className="recovery-trace-compact__text">{text}</span>
        )}
      </span>
    );
  }

  return (
    <span className="recovery-trace-compact">
      <span className="recovery-trace-compact__label">
        복구 {trace.length}회
      </span>
    </span>
  );
}

// ── Expanded variant ──
// Full timeline using .activity-item rail pattern from dashboard.css §8.3

interface EntryFieldProps {
  fieldLabel: string;
  value: string;
}

function EntryField({ fieldLabel, value }: EntryFieldProps) {
  return (
    <div className="recovery-trace-entry__field">
      <span className="recovery-trace-entry__field-label">{fieldLabel}</span>
      <span className="recovery-trace-entry__field-value">{value}</span>
    </div>
  );
}

function ExpandedPanel({ trace }: { trace: AgentRecoveryTraceEntry[] }) {
  return (
    <div className="recovery-trace-expanded">
      {trace.map((entry, idx) => (
        <div key={idx} className="recovery-trace-entry activity-item">
          <div
            className="recovery-trace-entry__icon activity-icon"
            aria-hidden="true"
          >
            <span className="recovery-trace-entry__step-num">{idx + 1}</span>
          </div>
          <div className="recovery-trace-entry__body">
            {entry.deficiency && (
              <EntryField fieldLabel="결함" value={entry.deficiency} />
            )}
            {entry.action && (
              <EntryField fieldLabel="조치" value={entry.action} />
            )}
            {entry.outcome && (
              <EntryField fieldLabel="결과" value={entry.outcome} />
            )}
            {entry.detail && (
              <EntryField fieldLabel="상세" value={entry.detail} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── RecoveryTracePanel ──

export const RecoveryTracePanel: React.FC<RecoveryTracePanelProps> = ({
  trace,
  variant = "expanded",
  className,
}) => {
  // Empty trace → null (filler 금지 — doctrine §3.1)
  if (!trace || trace.length === 0) return null;

  return (
    <div className={cn("recovery-trace-panel", className)}>
      {variant === "compact" ? (
        <CompactPanel trace={trace} />
      ) : (
        <ExpandedPanel trace={trace} />
      )}
    </div>
  );
};
