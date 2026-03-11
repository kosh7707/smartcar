import React from "react";

interface Props {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
  accent?: boolean;
  onClick?: () => void;
  detail?: React.ReactNode;
}

export const StatCard: React.FC<Props> = ({ icon, label, value, color, accent, onClick, detail }) => {
  return (
    <div
      className={`stat-card${accent ? " stat-card--accent" : ""}${onClick ? " stat-card--clickable" : ""}`}
      onClick={onClick}
    >
      <div className="stat-card__header">
        {icon}
        <span className="stat-card__label">{label}</span>
      </div>
      <div className="stat-card__value" style={color ? { color } : undefined}>
        {value}
      </div>
      {detail && <div className="stat-card__detail">{detail}</div>}
    </div>
  );
};
