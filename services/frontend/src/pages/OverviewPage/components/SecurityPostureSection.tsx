import React from "react";
import { Card } from "@/components/ui/card";
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
  tone: string;
}> = [
  { key: "critical", label: "Critical", tone: "var(--aegis-severity-critical)" },
  { key: "high", label: "High", tone: "var(--aegis-severity-high)" },
  { key: "medium", label: "Medium", tone: "var(--aegis-severity-medium)" },
  { key: "low", label: "Low", tone: "var(--aegis-severity-low)" },
];

export const SecurityPostureSection: React.FC<SecurityPostureSectionProps> = ({
  severity,
  totalFindings,
  onOpenAllFindings,
  onOpenSeverity,
}) => (
  <section className="space-y-5">
    <OverviewSectionHeader title="보안 현황" />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Card
        className="cursor-pointer gap-3 border-border/70 border-t-2 bg-card/80 p-5 shadow-none transition-colors hover:bg-muted/40"
        onClick={onOpenAllFindings}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">총 Finding</span>
        <span className="font-mono text-4xl font-semibold leading-none tracking-tight text-foreground">{totalFindings}</span>
        <span className="text-sm text-muted-foreground">전체 취약점 보기</span>
      </Card>

      {severityCards.map((card) => (
        <Card
          key={card.key}
          className="cursor-pointer gap-3 border-border/70 border-l-2 bg-card/80 p-5 shadow-none transition-colors hover:bg-muted/40"
          onClick={() => onOpenSeverity(card.key)}
          style={{ borderLeftColor: card.tone }}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: card.tone }}>
            {card.label}
          </span>
          <span className="font-mono text-4xl font-semibold leading-none tracking-tight text-foreground">
            {severity[card.key] ?? 0}
          </span>
          <span className="text-sm text-muted-foreground">해당 심각도 보기</span>
        </Card>
      ))}
    </div>
  </section>
);
