import React from "react";
import type { DashboardChip } from "../dashboardModel";
import "./DashboardChipList.css";

interface DashboardChipListProps {
  chips: DashboardChip[];
  compact?: boolean;
}

export const DashboardChipList: React.FC<DashboardChipListProps> = ({ chips, compact = false }) => (
  <div className="dashboard-chip-list">
    {chips.map((chip) => (
      <span
        key={chip.label}
        className={`dashboard-chip dashboard-chip--${chip.tone}${compact ? " dashboard-chip--compact" : ""}`}
      >
        {chip.label}
      </span>
    ))}
  </div>
);
