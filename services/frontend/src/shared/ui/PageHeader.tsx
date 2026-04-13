import React from "react";
import "./PageHeader.css";

interface Props {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  surface?: "card" | "plain";
}

export const PageHeader: React.FC<Props> = ({
  title,
  eyebrow,
  subtitle,
  icon,
  action,
  surface = "card",
}) => {
  return (
    <div className={`page-header page-header--${surface}${surface === "card" ? " card" : ""}`}>
      <div className="page-header__left">
        {icon && <div className="page-header__icon">{icon}</div>}
        <div className="page-header__text">
          {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
          <h2 className="page-header__title">{title}</h2>
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </div>
  );
};
