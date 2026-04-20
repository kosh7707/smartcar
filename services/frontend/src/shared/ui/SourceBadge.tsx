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
      return "source-badge source-badge--rule-engine";
    case "llm-assist":
      return "source-badge source-badge--llm-assist";
    case "both":
      return "source-badge source-badge--both";
    case "agent":
      return "source-badge source-badge--agent";
    case "sast-tool":
      return "source-badge source-badge--sast-tool";
    default:
      return "source-badge";
  }
};

export const SourceBadge: React.FC<Props> = ({ sourceType, ruleId }) => {
  const label = sourceType === "rule-engine" && ruleId ? `${SOURCE_TYPE_LABELS[sourceType]}: ${ruleId}` : SOURCE_TYPE_LABELS[sourceType];
  return (
    <Badge variant="outline" className={`${sourceBadgeClass(sourceType)} badge-source--${sourceType}`} title={SOURCE_TYPE_DESCRIPTIONS[sourceType]}>
      {label}
    </Badge>
  );
};
