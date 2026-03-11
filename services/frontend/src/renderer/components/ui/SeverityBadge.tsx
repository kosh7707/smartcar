import React from "react";
import type { Severity } from "@smartcar/shared";

interface Props {
  severity: Severity | string;
  size?: "sm" | "md";
}

export const SeverityBadge: React.FC<Props> = ({ severity, size = "md" }) => {
  const cls = size === "sm" ? "badge badge-sm" : "badge";
  return (
    <span className={`${cls} badge-${severity}`}>
      {severity.toUpperCase()}
    </span>
  );
};
