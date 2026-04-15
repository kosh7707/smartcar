import React from "react";
import type { FindingStatus } from "@aegis/shared";
import { FINDING_STATUS_LABELS, FINDING_STATUS_ORDER } from "../../constants/finding";

interface Props {
  byStatus: Record<string, number>;
}

const STATUS_CSS_KEY: Record<string, string> = {
  open: "open",
  needs_review: "needs-review",
  accepted_risk: "accepted-risk",
  false_positive: "false-positive",
  fixed: "fixed",
  needs_revalidation: "needs-revalidation",
  sandbox: "sandbox",
};

export const FindingSummary: React.FC<Props> = ({ byStatus }) => {
  const entries = FINDING_STATUS_ORDER
    .filter((s) => (byStatus[s] ?? 0) > 0)
    .map((s) => ({ status: s, count: byStatus[s], cssKey: STATUS_CSS_KEY[s] ?? s }));

  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (total === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {entries.map((e) => (
          <div
            key={e.status}
            className="min-w-0 transition-[width] duration-500 ease-out"
            style={{
              width: `${(e.count / total) * 100}%`,
              background: `var(--status-${e.cssKey})`,
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-5">
        {entries.map((e) => (
          <div key={e.status} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: `var(--status-${e.cssKey})` }}
            />
            <span className="text-sm text-muted-foreground">
              {FINDING_STATUS_LABELS[e.status]}
            </span>
            <span className="text-sm font-semibold text-foreground">{e.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
