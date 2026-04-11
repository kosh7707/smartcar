import React from "react";
import "./DashboardSectionHeading.css";

interface DashboardSectionHeadingProps {
  title: string;
  actions?: React.ReactNode;
}

export const DashboardSectionHeading: React.FC<DashboardSectionHeadingProps> = ({ title, actions }) => (
  <div className="dashboard-section-heading">
    <h2 className="dashboard-section-heading__title">{title}</h2>
    {actions ? <div className="dashboard-section-heading__actions">{actions}</div> : null}
  </div>
);
