import React from "react";
import type { Confidence, FindingSourceType } from "@aegis/shared";
import { CONFIDENCE_LABELS, CONFIDENCE_DESCRIPTIONS, SOURCE_TYPE_LABELS } from "../../constants/finding";

interface Props {
  confidence: Confidence;
  sourceType?: FindingSourceType;
  confidenceScore?: number;
}

export const ConfidenceBadge: React.FC<Props> = ({ confidence, sourceType, confidenceScore }) => {
  const scoreText = confidenceScore != null ? `${(confidenceScore * 100).toFixed(0)}%` : null;
  const sourceLabel = sourceType ? SOURCE_TYPE_LABELS[sourceType] : null;
  const tooltip = [
    CONFIDENCE_DESCRIPTIONS[confidence],
    scoreText ? `수치: ${scoreText}` : null,
    sourceLabel ? `출처: ${sourceLabel}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <span className={`badge badge-confidence--${confidence}`} title={tooltip}>
      {scoreText ?? CONFIDENCE_LABELS[confidence]}
    </span>
  );
};
