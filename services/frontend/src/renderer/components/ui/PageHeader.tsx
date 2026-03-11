import React from "react";
import "./PageHeader.css";

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<Props> = ({ title, subtitle, icon, action }) => {
  return (
    <div className="page-header card">
      <div className="page-header__left">
        {icon && <div className="page-header__icon">{icon}</div>}
        <div className="page-header__text">
          <h2 className="page-header__title">{title}</h2>
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </div>
  );
};
