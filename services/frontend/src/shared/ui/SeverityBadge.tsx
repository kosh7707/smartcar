import React from "react";
import type { Severity } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";

interface Props {
  severity: Severity | string;
  size?: "sm" | "md";
}

export const SeverityBadge: React.FC<Props> = ({ severity, size = "md" }) => {
  const cls = size === "sm" ? "badge-sm" : "";
  return (
    <Badge variant="outline" className={`${cls} badge-${severity}`.trim()}>
      {severity.toUpperCase()}
    </Badge>
  );
};
