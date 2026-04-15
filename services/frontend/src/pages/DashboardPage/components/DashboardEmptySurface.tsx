import React from "react";
import { cn } from "@/lib/utils";

interface DashboardEmptySurfaceProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "default" | "attention";
  variant?: "panel" | "inline";
}

export const DashboardEmptySurface: React.FC<DashboardEmptySurfaceProps> = ({
  title,
  description,
  action,
  tone = "default",
  variant = "panel",
}) => (
  <div
    className={cn(
      "border border-border bg-gradient-to-b from-background to-muted/70",
      variant === "panel" ? "flex flex-col items-start gap-4 rounded-2xl p-5" : "block rounded-xl p-4",
      tone === "attention" && "border-[color-mix(in_srgb,var(--aegis-severity-critical)_16%,var(--border))] bg-[color-mix(in_srgb,var(--aegis-severity-critical-bg)_70%,var(--muted))]",
    )}
  >
    <div className="min-w-0">
      <strong className={cn("block font-semibold tracking-tight text-foreground", variant === "panel" ? "text-base" : "text-sm")}>{title}</strong>
      <p className={cn("mt-2 text-sm text-muted-foreground", variant === "panel" ? "max-w-3xl leading-relaxed" : "leading-relaxed")}>{description}</p>
      {variant === "inline" && action ? <div className="mt-3">{action}</div> : null}
    </div>
  </div>
);
