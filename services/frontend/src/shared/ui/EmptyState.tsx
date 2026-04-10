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
      <div className="empty-state__surface">
        {icon && (
          <div className="empty-state__icon-shell">
            <div className="empty-state__icon">{icon}</div>
          </div>
        )}
        <div className="empty-state__copy">
          <h2 className="empty-state__title">{title}</h2>
          {description && <p className="empty-state__desc">{description}</p>}
        </div>
        {action && <div className="empty-state__action">{action}</div>}
      </div>
    </div>
  );
};
