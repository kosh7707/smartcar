import React from "react";
import "./EmptyState.css";

interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<Props> = ({ title, description, action, compact, className }) => {
  if (compact) {
    return (
      <div className="empty-state--compact">
        <span className="empty-state--compact__title">{title}</span>
      </div>
    );
  }

  return (
    <div className={`empty-state card${className ? ` ${className}` : ""}`}>
      <div className="empty-state__surface">
        <div className="empty-state__copy">
          <h2 className="empty-state__title">{title}</h2>
          {description && <p className="empty-state__desc">{description}</p>}
        </div>
        {action && <div className="empty-state__action">{action}</div>}
      </div>
    </div>
  );
};
