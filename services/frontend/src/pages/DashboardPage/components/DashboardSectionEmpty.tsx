import React from "react";

interface DashboardSectionEmptyProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "default" | "attention";
}

export const DashboardSectionEmpty: React.FC<DashboardSectionEmptyProps> = ({
  icon,
  title,
  description,
  action,
  tone = "default",
}) => (
  <div className={`dashboard-section-empty dashboard-section-empty--${tone}`}>
    <div className="dashboard-section-empty__marker" aria-hidden="true">
      <span className="dashboard-section-empty__rule" />
      <span className="dashboard-section-empty__icon">{icon}</span>
    </div>
    <div className="dashboard-section-empty__copy">
      <div className="dashboard-section-empty__title-row">
        <strong className="dashboard-section-empty__title">{title}</strong>
      </div>
      <p className="dashboard-section-empty__description">{description}</p>
      {action ? <div className="dashboard-section-empty__action">{action}</div> : null}
    </div>
  </div>
);
