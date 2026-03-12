import React from "react";
import "./EmptyState.css";

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<Props> = ({ icon, title, description, action, compact }) => {
  if (compact) {
    return (
      <div className="empty-state--compact">
        {icon && <span className="empty-state--compact__icon">{icon}</span>}
        <span className="empty-state--compact__title">{title}</span>
      </div>
    );
  }

  return (
    <div className="empty-state card">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
};
