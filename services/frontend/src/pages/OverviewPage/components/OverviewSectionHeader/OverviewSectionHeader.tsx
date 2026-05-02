import "./OverviewSectionHeader.css";
import React from "react";

interface OverviewSectionHeaderProps {
  title: string;
}

export const OverviewSectionHeader: React.FC<OverviewSectionHeaderProps> = ({ title }) => (
  <div className="overview-section-header">
    <h2 className="overview-section-header__title">{title}</h2>
    <hr className="divider overview-section-header__separator"  />
  </div>
);
