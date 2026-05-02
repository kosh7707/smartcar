import React from "react";
import type { FindingStatus } from "@aegis/shared";
import { cn } from "@/common/utils/cn";
import { FINDING_STATUS_DESCRIPTIONS, FINDING_STATUS_LABELS } from "@/common/constants/finding";

interface Props {
  status: FindingStatus;
  size?: "sm" | "md";
}

export const findingStatusBadgeClass = (status: FindingStatus) => {
  switch (status) {
    case "open":
      return "finding-status-badge finding-status-badge--open";
    case "needs_review":
      return "finding-status-badge finding-status-badge--needs-review";
    case "accepted_risk":
      return "finding-status-badge finding-status-badge--accepted-risk";
    case "false_positive":
      return "finding-status-badge finding-status-badge--false-positive";
    case "fixed":
      return "finding-status-badge finding-status-badge--fixed";
    case "needs_revalidation":
      return "finding-status-badge finding-status-badge--needs-revalidation";
    case "sandbox":
      return "finding-status-badge finding-status-badge--sandbox";
    default:
      return "finding-status-badge";
  }
};

export const FindingStatusBadge: React.FC<Props> = ({ status, size = "md" }) => (
  <span
    className={cn(
      findingStatusBadgeClass(status),
      `badge-status--${status}` ,
      size === "sm" ? "finding-status-badge--sm text-xs" : "finding-status-badge--md",
    )}
    title={FINDING_STATUS_DESCRIPTIONS[status]}
  >
    {FINDING_STATUS_LABELS[status]}
  </span>
);
