import React from "react";
import { cn } from "@/common/utils/cn";

interface Props {
  label: string;
  value: number | string;
  color?: string;
  accent?: boolean;
  onClick?: () => void;
  detail?: React.ReactNode;
}

export const StatCard: React.FC<Props> = ({ label, value, color, accent, onClick, detail }) => {
  return (
    <article
      className={cn(
        "placeholder-card stat-card",
        onClick && "stat-card--clickable",
        accent && "stat-card--accent",
      )}
      onClick={onClick}
      style={{ color: color ?? undefined }}
    >
      <span className="eyebrow">{label}</span>
      <div className="stat-card__value">{value}</div>
      {detail ? <p className="stat-card__detail">{detail}</p> : null}
    </article>
  );
};
