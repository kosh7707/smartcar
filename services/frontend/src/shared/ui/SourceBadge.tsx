import React from "react";
import type { FindingSourceType } from "@aegis/shared";
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_DESCRIPTIONS } from "../../constants/finding";

interface Props {
  sourceType: FindingSourceType;
  ruleId?: string;
}

export const SourceBadge: React.FC<Props> = ({ sourceType, ruleId }) => {
  const label = sourceType === "rule-engine" && ruleId
    ? `${SOURCE_TYPE_LABELS[sourceType]}: ${ruleId}`
    : SOURCE_TYPE_LABELS[sourceType];

  return (
    <span className={`badge badge-source--${sourceType}`} title={SOURCE_TYPE_DESCRIPTIONS[sourceType]}>
      {label}
    </span>
  );
};
