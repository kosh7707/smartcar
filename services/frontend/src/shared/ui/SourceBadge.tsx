import React from "react";
import type { FindingSourceType } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { SOURCE_TYPE_DESCRIPTIONS, SOURCE_TYPE_LABELS } from "../../constants/finding";

interface Props {
  sourceType: FindingSourceType;
  ruleId?: string;
}

export const sourceBadgeClass = (sourceType: FindingSourceType) => {
  switch (sourceType) {
    case "rule-engine":
      return "border-[var(--aegis-source-rule-border)] bg-[var(--aegis-source-rule-bg)] text-[var(--aegis-source-rule)]";
    case "llm-assist":
      return "border-[var(--aegis-source-ai-border)] bg-[var(--aegis-source-ai-bg)] text-[var(--aegis-source-ai)]";
    case "both":
      return "border-[var(--aegis-source-both-border)] bg-[var(--aegis-source-both-bg)] text-[var(--aegis-source-both)]";
    case "agent":
      return "border-[var(--aegis-source-agent-border)] bg-[var(--aegis-source-agent-bg)] text-[var(--aegis-source-agent)]";
    case "sast-tool":
      return "border-[var(--aegis-source-sast-border)] bg-[var(--aegis-source-sast-bg)] text-[var(--aegis-source-sast)]";
    default:
      return "border-border bg-background text-foreground";
  }
};

export const SourceBadge: React.FC<Props> = ({ sourceType, ruleId }) => {
  const label = sourceType === "rule-engine" && ruleId ? `${SOURCE_TYPE_LABELS[sourceType]}: ${ruleId}` : SOURCE_TYPE_LABELS[sourceType];
  return (
    <Badge variant="outline" className={`badge-source--${sourceType} ${sourceBadgeClass(sourceType)}`} title={SOURCE_TYPE_DESCRIPTIONS[sourceType]}>
      {label}
    </Badge>
  );
};
