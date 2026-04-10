import React from "react";
import type { BuildTarget } from "@aegis/shared";
import { TargetStatusBadge } from "../../../shared/ui";
import { OverviewSectionHeader } from "./OverviewSectionHeader";

interface BuildTargetsSectionProps {
  targets: BuildTarget[];
  onOpenFiles: () => void;
}

export const BuildTargetsSection: React.FC<BuildTargetsSectionProps> = ({ targets, onOpenFiles }) => {
  if (targets.length === 0) return null;

  return (
    <div className="overview-block">
      <OverviewSectionHeader title="Build Targets" />
      <div className="overview-targets-grid">
        {targets.map((target) => (
          <div key={target.id} className="overview-target-card" onClick={onOpenFiles}>
            <span className="overview-target-card__name">{target.name}</span>
            <div className="overview-target-card__footer">
              <div>
                <span className="overview-target-card__count-label">Findings</span>
                <span className="overview-target-card__count-value">—</span>
              </div>
              <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
