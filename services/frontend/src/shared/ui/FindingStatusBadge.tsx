import React from "react";
import type { FindingStatus } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FINDING_STATUS_DESCRIPTIONS, FINDING_STATUS_LABELS } from "../../constants/finding";

interface Props {
  status: FindingStatus;
  size?: "sm" | "md";
}

export const findingStatusBadgeClass = (status: FindingStatus) => {
  switch (status) {
    case "open":
      return "border-[var(--aegis-status-open-border)] bg-[var(--aegis-status-open-bg)] text-[var(--aegis-status-open)]";
    case "needs_review":
      return "border-[var(--aegis-status-needs-review-border)] bg-[var(--aegis-status-needs-review-bg)] text-[var(--aegis-status-needs-review)]";
    case "accepted_risk":
      return "border-[var(--aegis-status-accepted-risk-border)] bg-[var(--aegis-status-accepted-risk-bg)] text-[var(--aegis-status-accepted-risk)]";
    case "false_positive":
      return "border-[var(--aegis-status-false-positive-border)] bg-[var(--aegis-status-false-positive-bg)] text-[var(--aegis-status-false-positive)]";
    case "fixed":
      return "border-[var(--aegis-status-fixed-border)] bg-[var(--aegis-status-fixed-bg)] text-[var(--aegis-status-fixed)]";
    case "needs_revalidation":
      return "border-[var(--aegis-status-needs-revalidation-border)] bg-[var(--aegis-status-needs-revalidation-bg)] text-[var(--aegis-status-needs-revalidation)]";
    case "sandbox":
      return "border-[var(--aegis-status-sandbox-border)] bg-[var(--aegis-status-sandbox-bg)] text-[var(--aegis-status-sandbox)]";
    default:
      return "border-border bg-background text-foreground";
  }
};

export const FindingStatusBadge: React.FC<Props> = ({ status, size = "md" }) => (
  <Badge variant="outline" className={cn(size === "sm" && "text-xs", `badge-status--${status}`, findingStatusBadgeClass(status))} title={FINDING_STATUS_DESCRIPTIONS[status]}>
    {FINDING_STATUS_LABELS[status]}
  </Badge>
);
