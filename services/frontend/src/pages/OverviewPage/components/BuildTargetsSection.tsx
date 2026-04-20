import React from "react";
import type { BuildTarget } from "@aegis/shared";
import { HardDrive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TargetStatusBadge } from "../../../shared/ui";
import { OverviewSectionHeader } from "./OverviewSectionHeader";

interface BuildTargetsSectionProps {
  targets: BuildTarget[];
  onOpenFiles: () => void;
}

export const BuildTargetsSection: React.FC<BuildTargetsSectionProps> = ({ targets, onOpenFiles }) => {
  if (targets.length === 0) return null;

  return (
    <section className="overview-build-targets">
      <OverviewSectionHeader title="빌드 타겟" />
      <div className="overview-build-targets__grid">
        {targets.map((target) => (
          <Card
            key={target.id}
            className="overview-build-targets__card"
            onClick={onOpenFiles}
          >
            <div className="overview-build-targets__head">
              <div className="overview-build-targets__main">
                <div className="overview-build-targets__icon">
                  <HardDrive size={18} />
                </div>
                <div className="overview-build-targets__copy">
                  <span className="overview-build-targets__name">{target.name}</span>
                  <p className="overview-build-targets__description">
                    업로드된 소스와 연결된 빌드 입력을 정리하고 분석 흐름을 준비합니다.
                  </p>
                </div>
              </div>
              <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
            </div>

            <div className="overview-build-targets__foot">
              <div>
                <span className="overview-build-targets__metric-label">Findings</span>
                <span className="overview-build-targets__metric-value">—</span>
              </div>
              <span className="overview-build-targets__cta">소스 보기</span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
