import type { FindingStatus, FindingSourceType, Confidence } from "@smartcar/shared";

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open: "열림",
  needs_review: "검토 필요",
  accepted_risk: "위험 수용",
  false_positive: "오탐",
  fixed: "수정됨",
  needs_revalidation: "재검증 필요",
  sandbox: "샌드박스",
};

export const FINDING_STATUS_ORDER: FindingStatus[] = [
  "open",
  "needs_review",
  "needs_revalidation",
  "sandbox",
  "accepted_risk",
  "false_positive",
  "fixed",
];

export const ALLOWED_TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  open: ["needs_review", "accepted_risk", "false_positive", "fixed"],
  needs_review: ["accepted_risk", "false_positive", "fixed", "open"],
  accepted_risk: ["needs_review", "open"],
  false_positive: ["needs_review", "open"],
  fixed: ["needs_revalidation", "open"],
  needs_revalidation: ["open", "fixed", "false_positive"],
  sandbox: ["needs_review", "open", "false_positive"],
};

/** LLM-only finding은 accepted_risk/fixed로 직접 전이 불가 */
export function canTransitionTo(
  from: FindingStatus,
  to: FindingStatus,
  sourceType: FindingSourceType,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) return false;
  if (sourceType === "llm-assist" && (to === "accepted_risk" || to === "fixed")) return false;
  return true;
}

export const SOURCE_TYPE_LABELS: Record<FindingSourceType, string> = {
  "rule-engine": "룰",
  "llm-assist": "AI",
  both: "룰 + AI",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
};
