import React from "react";

interface OverviewHeaderProps {
  name: string;
  description?: string | null;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({ name, description }) => (
  <div className="overview-page-header">
    <div className="overview-page-header__info">
      <h1 className="overview-page-header__title">{name}</h1>
      {description && <span className="overview-page-header__subtitle">{description}</span>}
    </div>
  </div>
);
