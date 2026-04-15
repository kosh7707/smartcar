import React from "react";
import type { Severity } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  severity: Severity | string;
  size?: "sm" | "md";
}

export const SeverityBadge: React.FC<Props> = ({ severity, size = "md" }) => {
  return (
    <Badge variant="outline" className={cn(size === "sm" && "text-xs", `badge-severity--${severity}`)}>
      {severity.toUpperCase()}
    </Badge>
  );
};
