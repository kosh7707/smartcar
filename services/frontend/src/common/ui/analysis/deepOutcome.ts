import type {
  AgentAnalysisOutcome,
  AgentQualityOutcome,
  AgentPocOutcome,
} from "@aegis/shared";
import type { OutcomeKind, OutcomeTone } from "@/common/ui/primitives/OutcomeChip";

// ── deriveCleanPass ──

interface DeepResult {
  status?: string;
  analysisOutcome?: AgentAnalysisOutcome | string;
  qualityOutcome?: AgentQualityOutcome | string;
}

export function deriveCleanPass(result: DeepResult): boolean {
  return (
    result.status === "completed" &&
    result.analysisOutcome === "accepted_claims" &&
    result.qualityOutcome === "accepted"
  );
}

// ── deriveOutcomeTone ──

export function deriveOutcomeTone(
  value:
    | AgentAnalysisOutcome
    | AgentQualityOutcome
    | AgentPocOutcome
    | boolean
    | null
    | undefined,
): OutcomeTone {
  if (value === true) return "positive";
  if (value === false || value === null || value === undefined)
    return "fallback-review";

  switch (value as string) {
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

// ── formatOutcomeLabel ──

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

export function formatOutcomeLabel(
  kind: OutcomeKind,
  value:
    | AgentAnalysisOutcome
    | AgentQualityOutcome
    | AgentPocOutcome
    | boolean
    | null
    | undefined,
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

// ── deriveDominantOutcome ──
// 6-case matrix from shared-models §2.6.1

export interface DominantOutcome {
  tone: OutcomeTone;
  label: string;
}

export function deriveDominantOutcome(result: DeepResult): DominantOutcome {
  const { analysisOutcome, qualityOutcome } = result;

  // Case 1: clean pass
  if (deriveCleanPass(result)) {
    return { tone: "positive", label: "분석 완료" };
  }

  // Case 2: quality gate hard fail
  if (qualityOutcome === "rejected") {
    return { tone: "critical-review", label: "품질 게이트 실패" };
  }

  // Case 3: recovery exhausted
  if (qualityOutcome === "repair_exhausted") {
    return { tone: "critical-review", label: "자동 복구 한도 초과" };
  }

  // Case 4: accepted with caveats
  if (qualityOutcome === "accepted_with_caveats") {
    return { tone: "caution-review", label: "주의 필요 · 조건부 통과" };
  }

  // Case 5: no accepted claims
  if (analysisOutcome === "no_accepted_claims") {
    return { tone: "neutral-review", label: "수용된 발견 없음" };
  }

  // Case 6: inconclusive
  if (
    analysisOutcome === "inconclusive" ||
    qualityOutcome === "inconclusive"
  ) {
    return { tone: "caution-review", label: "분석 결론 불가" };
  }

  return { tone: "fallback-review", label: "결과 상태 확인 필요" };
}
