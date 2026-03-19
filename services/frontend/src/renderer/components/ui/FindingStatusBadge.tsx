import React from "react";
import type { FindingStatus } from "@aegis/shared";
import { FINDING_STATUS_LABELS, FINDING_STATUS_DESCRIPTIONS } from "../../constants/finding";

interface Props {
  status: FindingStatus;
  size?: "sm" | "md";
}

export const FindingStatusBadge: React.FC<Props> = ({ status, size = "md" }) => {
  const cls = size === "sm" ? "badge badge-sm" : "badge";
  return (
    <span className={`${cls} badge-status--${status}`} title={FINDING_STATUS_DESCRIPTIONS[status]}>
      {FINDING_STATUS_LABELS[status]}
    </span>
  );
};
