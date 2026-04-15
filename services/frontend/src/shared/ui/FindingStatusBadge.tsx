import React from "react";
import type { FindingStatus } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FINDING_STATUS_LABELS, FINDING_STATUS_DESCRIPTIONS } from "../../constants/finding";

interface Props {
  status: FindingStatus;
  size?: "sm" | "md";
}

export const FindingStatusBadge: React.FC<Props> = ({ status, size = "md" }) => {
  return (
    <Badge variant="outline" className={cn(size === "sm" && "text-xs", `badge-status--${status}`)} title={FINDING_STATUS_DESCRIPTIONS[status]}>
      {FINDING_STATUS_LABELS[status]}
    </Badge>
  );
};
