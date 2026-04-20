import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SeveritySummary } from "../overviewModel";
import { OverviewSectionHeader } from "./OverviewSectionHeader";

interface SecurityPostureSectionProps {
  severity: SeveritySummary;
  totalFindings: number;
  onOpenAllFindings: () => void;
  onOpenSeverity: (severity: "critical" | "high" | "medium" | "low") => void;
}

const severityCards: Array<{
  key: "critical" | "high" | "medium" | "low";
  label: string;
}> = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export const SecurityPostureSection: React.FC<SecurityPostureSectionProps> = ({
  severity,
  totalFindings,
  onOpenAllFindings,
  onOpenSeverity,
}) => (
  <section className="overview-security-posture">
    <OverviewSectionHeader title="보안 현황" />
    <div className="overview-security-posture__grid">
      <Card className="overview-security-posture__card overview-security-posture__card--total" onClick={onOpenAllFindings}>
        <span className="overview-security-posture__eyebrow">총 Finding</span>
        <span className="overview-security-posture__value">{totalFindings}</span>
        <span className="overview-security-posture__copy">전체 취약점 보기</span>
      </Card>

      {severityCards.map((card) => (
        <Card
          key={card.key}
          className={cn(
            "overview-security-posture__card overview-security-posture__card--severity",
            `overview-security-posture__card--${card.key}`,
          )}
          onClick={() => onOpenSeverity(card.key)}
        >
          <span className={cn("overview-security-posture__eyebrow", `overview-security-posture__eyebrow--${card.key}`)}>
            {card.label}
          </span>
          <span className="overview-security-posture__value">{severity[card.key] ?? 0}</span>
          <span className="overview-security-posture__copy">해당 심각도 보기</span>
        </Card>
      ))}
    </div>
  </section>
);
