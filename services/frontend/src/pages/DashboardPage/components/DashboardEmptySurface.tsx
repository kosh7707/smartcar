import React from "react";
import "./DashboardEmptySurface.css";

interface DashboardEmptySurfaceProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "default" | "attention";
  variant?: "panel" | "inline";
}

export const DashboardEmptySurface: React.FC<DashboardEmptySurfaceProps> = ({
  icon,
  title,
  description,
  action,
  tone = "default",
  variant = "panel",
}) => (
  <div className={`dashboard-empty-surface dashboard-empty-surface--${variant} dashboard-empty-surface--${tone}`}>
    <div className="dashboard-empty-surface__marker" aria-hidden="true">
      <span className="dashboard-empty-surface__icon">{icon}</span>
    </div>
    <div className="dashboard-empty-surface__copy">
      <strong className="dashboard-empty-surface__title">{title}</strong>
      <p className="dashboard-empty-surface__description">{description}</p>
      {variant === "inline" && action ? <div className="dashboard-empty-surface__action">{action}</div> : null}
    </div>
  </div>
);
