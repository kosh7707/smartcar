import React from "react";
import type { SeveritySummary } from "../overviewModel";
import { OverviewSectionHeader } from "./OverviewSectionHeader";

interface SecurityPostureSectionProps {
  severity: SeveritySummary;
  totalFindings: number;
  onOpenAllFindings: () => void;
  onOpenSeverity: (severity: "critical" | "high" | "medium" | "low") => void;
}

export const SecurityPostureSection: React.FC<SecurityPostureSectionProps> = ({
  severity,
  totalFindings,
  onOpenAllFindings,
  onOpenSeverity,
}) => (
  <div className="overview-block">
    <OverviewSectionHeader title="Security Posture" />
    <div className="overview-posture-grid">
      <div className="overview-stat-card overview-stat-card--total" onClick={onOpenAllFindings}>
        <span className="overview-stat-card__label">Total Findings</span>
        <span className="overview-stat-card__value">{totalFindings}</span>
      </div>
      <div
        className="overview-stat-card overview-stat-card--severity overview-stat-card--critical"
        onClick={() => onOpenSeverity("critical")}
      >
        <span className="overview-stat-card__label overview-stat-card__label--critical">Critical</span>
        <span className="overview-stat-card__value">{severity.critical ?? 0}</span>
      </div>
      <div
        className="overview-stat-card overview-stat-card--severity overview-stat-card--high"
        onClick={() => onOpenSeverity("high")}
      >
        <span className="overview-stat-card__label overview-stat-card__label--high">High</span>
        <span className="overview-stat-card__value">{severity.high ?? 0}</span>
      </div>
      <div
        className="overview-stat-card overview-stat-card--severity overview-stat-card--medium"
        onClick={() => onOpenSeverity("medium")}
      >
        <span className="overview-stat-card__label overview-stat-card__label--medium">Medium</span>
        <span className="overview-stat-card__value">{severity.medium ?? 0}</span>
      </div>
      <div
        className="overview-stat-card overview-stat-card--severity overview-stat-card--low"
        onClick={() => onOpenSeverity("low")}
      >
        <span className="overview-stat-card__label overview-stat-card__label--low">Low</span>
        <span className="overview-stat-card__value">{severity.low ?? 0}</span>
      </div>
    </div>
  </div>
);
