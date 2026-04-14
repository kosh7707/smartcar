import React from "react";
import "./StatCard.css";

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
    <div
      className={`stat-card${accent ? " stat-card--accent" : ""}${onClick ? " stat-card--clickable" : ""}`}
      style={color ? { "--stat-accent": color } as React.CSSProperties : undefined}
      onClick={onClick}
    >
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
      </div>
      <div className="stat-card__value" style={color ? { color } : undefined}>
        {value}
      </div>
      {detail && <div className="stat-card__detail">{detail}</div>}
    </div>
  );
};
