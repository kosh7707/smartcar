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

export const FINDING_STATUS_DESCRIPTIONS: Record<FindingStatus, string> = {
  open: "새로 발견되어 아직 검토되지 않은 Finding",
  needs_review: "분석가의 검토가 필요한 Finding",
  accepted_risk: "위험을 인지하고 수용한 Finding",
  false_positive: "실제 취약점이 아닌 것으로 판정된 Finding",
  fixed: "수정 조치가 완료된 Finding",
  needs_revalidation: "수정 후 재검증이 필요한 Finding",
  sandbox: "AI가 제안했으나 아직 룰로 확인되지 않은 Finding",
};

export const CONFIDENCE_DESCRIPTIONS: Record<Confidence, string> = {
  high: "룰 엔진 또는 다중 소스가 일치하는 높은 확신도",
  medium: "단일 소스 기반의 보통 확신도",
  low: "AI 추정 기반의 낮은 확신도",
};

export const SOURCE_TYPE_DESCRIPTIONS: Record<FindingSourceType, string> = {
  "rule-engine": "정적 분석 룰에 의해 탐지된 Finding",
  "llm-assist": "AI 모델이 제안한 Finding",
  both: "룰 엔진과 AI 모두 탐지한 Finding",
};
