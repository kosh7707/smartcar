import React from "react";

interface OverviewSectionHeaderProps {
  title: string;
}

export const OverviewSectionHeader: React.FC<OverviewSectionHeaderProps> = ({ title }) => (
  <div className="overview-section-header">
    <span className="overview-section-header__title">{title}</span>
    <span className="overview-section-header__line" />
  </div>
);
