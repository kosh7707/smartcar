import React from "react";
import { cn } from "@/common/utils/cn";

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
      <div className={cn("empty-state--compact", className)}>
        <div className="placeholder-card">
          <span className="eyebrow">empty</span>
          <h3>{title}</h3>
        </div>
      </div>
    );
  }

  return (
    <section className={cn("empty-state card", className)}>
      <div className="placeholder-card empty-state__surface">
        <div className="empty-state__copy">
          <div>
            <h2 className="empty-state__title">{title}</h2>
            {description ? <p className="empty-state__desc">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="empty-state__action">{action}</div> : null}
      </div>
    </section>
  );
};
