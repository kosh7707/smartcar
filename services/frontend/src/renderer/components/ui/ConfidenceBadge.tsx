import React from "react";
import type { Confidence } from "@smartcar/shared";
import { CONFIDENCE_LABELS, CONFIDENCE_DESCRIPTIONS } from "../../constants/finding";

interface Props {
  confidence: Confidence;
}

export const ConfidenceBadge: React.FC<Props> = ({ confidence }) => (
  <span className={`badge badge-confidence--${confidence}`} title={CONFIDENCE_DESCRIPTIONS[confidence]}>
    {CONFIDENCE_LABELS[confidence]}
  </span>
);
