import React from "react";
import type { FindingSourceType } from "@aegis/shared";
import { Sparkles, ShieldCheck, Bot, Wrench } from "lucide-react";
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_DESCRIPTIONS } from "../../constants/finding";

const SOURCE_ICONS: Record<FindingSourceType, React.ReactNode> = {
  "rule-engine": <ShieldCheck size={10} />,
  "llm-assist": <Sparkles size={10} />,
  both: <ShieldCheck size={10} />,
  agent: <Bot size={10} />,
  "sast-tool": <Wrench size={10} />,
};

interface Props {
  sourceType: FindingSourceType;
  ruleId?: string;
}

export const SourceBadge: React.FC<Props> = ({ sourceType, ruleId }) => {
  const icon = SOURCE_ICONS[sourceType] ?? <ShieldCheck size={10} />;

  const label = sourceType === "rule-engine" && ruleId
    ? `룰: ${ruleId}`
    : SOURCE_TYPE_LABELS[sourceType];

  return (
    <span className={`badge badge-source--${sourceType}`} title={SOURCE_TYPE_DESCRIPTIONS[sourceType]}>
      {icon} {label}
    </span>
  );
};
