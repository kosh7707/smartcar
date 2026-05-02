import React from "react";
import type {
  AgentAnalysisOutcome,
  AgentQualityOutcome,
  AgentPocOutcome,
} from "@aegis/shared";
import { cn } from "@/common/utils/cn";
import "@/common/styles/handoff/components/outcome-chip.css";

export type OutcomeKind = "analysis" | "quality" | "poc" | "cleanPass";
export type OutcomeTone =
  | "positive"
  | "neutral-review"
  | "caution-review"
  | "critical-review"
  | "fallback-review";

export interface OutcomeChipProps {
  kind: OutcomeKind;
  value:
    | AgentAnalysisOutcome
    | AgentQualityOutcome
    | AgentPocOutcome
    | boolean
    | null
    | undefined;
  tone?: OutcomeTone;
  label?: string;
  size?: "sm" | "md";
  showDot?: boolean;
}

// ── Label maps ──

const ANALYSIS_LABELS: Record<string, string> = {
  accepted_claims: "유효 발견 있음",
  no_accepted_claims: "수용된 발견 없음",
  inconclusive: "결론 불가",
};

const QUALITY_LABELS: Record<string, string> = {
  accepted: "품질 통과",
  accepted_with_caveats: "조건부 품질 통과",
  rejected: "품질 게이트 실패",
  inconclusive: "품질 결론 불가",
  repair_exhausted: "복구 한도 초과",
};

const POC_LABELS: Record<string, string> = {
  poc_accepted: "PoC 재현 성공",
  poc_rejected: "PoC 재현 실패",
  poc_inconclusive: "PoC 결론 불가",
  poc_not_requested: "PoC 미요청",
};

function resolveLabel(
  kind: OutcomeKind,
  value: OutcomeChipProps["value"],
): string {
  if (kind === "cleanPass") {
    if (value === true) return "분석 완료";
    if (value === false) return "결과 검토 필요";
    return "결과 상태 확인 필요";
  }
  if (typeof value === "string") {
    if (kind === "analysis") return ANALYSIS_LABELS[value] ?? "결과 상태 확인 필요";
    if (kind === "quality") return QUALITY_LABELS[value] ?? "결과 상태 확인 필요";
    if (kind === "poc") return POC_LABELS[value] ?? "결과 상태 확인 필요";
  }
  return "결과 상태 확인 필요";
}

// ── Tone auto-resolution ──

function resolveTone(
  kind: OutcomeKind,
  value: OutcomeChipProps["value"],
): OutcomeTone {
  if (kind === "cleanPass") {
    if (value === true) return "positive";
    if (value === false) return "caution-review";
    return "fallback-review";
  }
  if (typeof value === "string") {
    switch (value) {
      case "accepted_claims":
      case "accepted":
      case "poc_accepted":
        return "positive";
      case "no_accepted_claims":
      case "poc_not_requested":
        return "neutral-review";
      case "accepted_with_caveats":
      case "inconclusive":
      case "poc_inconclusive":
        return "caution-review";
      case "rejected":
      case "repair_exhausted":
      case "poc_rejected":
        return "critical-review";
      default:
        return "fallback-review";
    }
  }
  return "fallback-review";
}

export const OutcomeChip: React.FC<OutcomeChipProps> = ({
  kind,
  value,
  tone,
  label,
  size = "md",
  showDot = false,
}) => {
  const resolvedTone = tone ?? resolveTone(kind, value);
  const resolvedLabel = label ?? resolveLabel(kind, value);

  return (
    <span
      className={cn(
        "outcome-chip",
        `outcome-chip--${resolvedTone}`,
        size === "sm" ? "outcome-chip--sm" : "outcome-chip--md",
      )}
    >
      {showDot && <span className="outcome-chip__dot" aria-hidden="true" />}
      <span className="outcome-chip__label">{resolvedLabel}</span>
    </span>
  );
};
