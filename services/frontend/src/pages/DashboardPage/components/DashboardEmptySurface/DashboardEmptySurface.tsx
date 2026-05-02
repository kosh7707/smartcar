import "./DashboardEmptySurface.css";
import React from "react";
import { cn } from "@/common/utils/cn";

interface DashboardEmptySurfaceProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "default" | "attention";
  variant?: "panel" | "inline";
}

export const DashboardEmptySurface: React.FC<DashboardEmptySurfaceProps> = ({ title, description, action, tone = "default", variant = "panel" }) => (
  <div className={cn(variant === "panel" ? "placeholder-card" : "dashboard-empty-inline", tone === "attention" && "surface-panel-body") }>
    <span className="eyebrow">{tone === "attention" ? "attention" : "empty"}</span>
    <h3>{title}</h3>
    <p>{description}</p>
    {action ? <div>{action}</div> : null}
  </div>
)
