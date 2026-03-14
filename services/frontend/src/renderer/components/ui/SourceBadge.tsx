import React from "react";
import type { FindingSourceType } from "@smartcar/shared";
import { Sparkles, ShieldCheck } from "lucide-react";
import { SOURCE_TYPE_LABELS } from "../../constants/finding";

interface Props {
  sourceType: FindingSourceType;
  ruleId?: string;
}

export const SourceBadge: React.FC<Props> = ({ sourceType, ruleId }) => {
  const icon = sourceType === "llm-assist"
    ? <Sparkles size={10} />
    : <ShieldCheck size={10} />;

  const label = sourceType === "rule-engine" && ruleId
    ? `룰: ${ruleId}`
    : SOURCE_TYPE_LABELS[sourceType];

  return (
    <span className={`badge badge-source--${sourceType}`}>
      {icon} {label}
    </span>
  );
};
