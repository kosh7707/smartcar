import { describe, it, expect } from "vitest";
import {
  deriveCleanPass,
  deriveOutcomeTone,
  formatOutcomeLabel,
  deriveDominantOutcome,
} from "./deepOutcome";

// ── deriveCleanPass ──

describe("deriveCleanPass", () => {
  it("returns true when status=completed + accepted_claims + accepted", () => {
    expect(
      deriveCleanPass({
        status: "completed",
        analysisOutcome: "accepted_claims",
        qualityOutcome: "accepted",
      }),
    ).toBe(true);
  });

  it("returns false when status is not completed", () => {
    expect(
      deriveCleanPass({
        status: "failed",
        analysisOutcome: "accepted_claims",
        qualityOutcome: "accepted",
      }),
    ).toBe(false);
  });

  it("returns false when analysisOutcome is not accepted_claims", () => {
    expect(
      deriveCleanPass({
        status: "completed",
        analysisOutcome: "no_accepted_claims",
        qualityOutcome: "accepted",
      }),
    ).toBe(false);
  });

  it("returns false when qualityOutcome is not accepted", () => {
    expect(
      deriveCleanPass({
        status: "completed",
        analysisOutcome: "accepted_claims",
        qualityOutcome: "accepted_with_caveats",
      }),
    ).toBe(false);
  });

  it("returns false when fields are missing", () => {
    expect(deriveCleanPass({ status: "completed" })).toBe(false);
  });
});

// ── deriveOutcomeTone ──

describe("deriveOutcomeTone", () => {
  it("true → positive", () => {
    expect(deriveOutcomeTone(true)).toBe("positive");
  });

  it("false → fallback-review", () => {
    expect(deriveOutcomeTone(false)).toBe("fallback-review");
  });

  it("null → fallback-review", () => {
    expect(deriveOutcomeTone(null)).toBe("fallback-review");
  });

  it("undefined → fallback-review", () => {
    expect(deriveOutcomeTone(undefined)).toBe("fallback-review");
  });

  it("accepted_claims → positive", () => {
    expect(deriveOutcomeTone("accepted_claims")).toBe("positive");
  });

  it("accepted → positive", () => {
    expect(deriveOutcomeTone("accepted")).toBe("positive");
  });

  it("poc_accepted → positive", () => {
    expect(deriveOutcomeTone("poc_accepted")).toBe("positive");
  });

  it("no_accepted_claims → neutral-review", () => {
    expect(deriveOutcomeTone("no_accepted_claims")).toBe("neutral-review");
  });

  it("poc_not_requested → neutral-review", () => {
    expect(deriveOutcomeTone("poc_not_requested")).toBe("neutral-review");
  });

  it("accepted_with_caveats → caution-review", () => {
    expect(deriveOutcomeTone("accepted_with_caveats")).toBe("caution-review");
  });

  it("inconclusive → caution-review", () => {
    expect(deriveOutcomeTone("inconclusive")).toBe("caution-review");
  });

  it("poc_inconclusive → caution-review", () => {
    expect(deriveOutcomeTone("poc_inconclusive")).toBe("caution-review");
  });

  it("rejected → critical-review", () => {
    expect(deriveOutcomeTone("rejected")).toBe("critical-review");
  });

  it("repair_exhausted → critical-review", () => {
    expect(deriveOutcomeTone("repair_exhausted")).toBe("critical-review");
  });

  it("poc_rejected → critical-review", () => {
    expect(deriveOutcomeTone("poc_rejected")).toBe("critical-review");
  });

  it("unknown enum → fallback-review (forward-compat)", () => {
    expect(deriveOutcomeTone("future_unknown_value" as never)).toBe(
      "fallback-review",
    );
  });
});

// ── formatOutcomeLabel ──

describe("formatOutcomeLabel", () => {
  it("analysis / accepted_claims → '유효 발견 있음'", () => {
    expect(formatOutcomeLabel("analysis", "accepted_claims")).toBe(
      "유효 발견 있음",
    );
  });

  it("quality / repair_exhausted → '복구 한도 초과'", () => {
    expect(formatOutcomeLabel("quality", "repair_exhausted")).toBe(
      "복구 한도 초과",
    );
  });

  it("poc / poc_not_requested → 'PoC 미요청'", () => {
    expect(formatOutcomeLabel("poc", "poc_not_requested")).toBe("PoC 미요청");
  });

  it("cleanPass / true → '분석 완료'", () => {
    expect(formatOutcomeLabel("cleanPass", true)).toBe("분석 완료");
  });

  it("cleanPass / false → '결과 검토 필요'", () => {
    expect(formatOutcomeLabel("cleanPass", false)).toBe("결과 검토 필요");
  });

  it("cleanPass / null → '결과 상태 확인 필요'", () => {
    expect(formatOutcomeLabel("cleanPass", null)).toBe("결과 상태 확인 필요");
  });

  it("unknown enum → '결과 상태 확인 필요'", () => {
    expect(formatOutcomeLabel("analysis", "future_unknown" as never)).toBe(
      "결과 상태 확인 필요",
    );
  });
});

// ── deriveDominantOutcome — 6-case matrix ──

describe("deriveDominantOutcome — 6-case matrix", () => {
  // Case 1: clean pass
  it("Case 1 — clean: positive / '분석 완료'", () => {
    const result = deriveDominantOutcome({
      status: "completed",
      analysisOutcome: "accepted_claims",
      qualityOutcome: "accepted",
    });
    expect(result.tone).toBe("positive");
    expect(result.label).toBe("분석 완료");
  });

  // Case 2: quality rejected
  it("Case 2 — qualityOutcome=rejected: critical-review / '품질 게이트 실패'", () => {
    const result = deriveDominantOutcome({
      status: "completed",
      analysisOutcome: "accepted_claims",
      qualityOutcome: "rejected",
    });
    expect(result.tone).toBe("critical-review");
    expect(result.label).toBe("품질 게이트 실패");
  });

  // Case 3: repair exhausted
  it("Case 3 — qualityOutcome=repair_exhausted: critical-review / '자동 복구 한도 초과'", () => {
    const result = deriveDominantOutcome({
      status: "completed",
      analysisOutcome: "accepted_claims",
      qualityOutcome: "repair_exhausted",
    });
    expect(result.tone).toBe("critical-review");
    expect(result.label).toBe("자동 복구 한도 초과");
  });

  // Case 4: accepted with caveats
  it("Case 4 — qualityOutcome=accepted_with_caveats: caution-review / '주의 필요 · 조건부 통과'", () => {
    const result = deriveDominantOutcome({
      status: "completed",
      analysisOutcome: "accepted_claims",
      qualityOutcome: "accepted_with_caveats",
    });
    expect(result.tone).toBe("caution-review");
    expect(result.label).toBe("주의 필요 · 조건부 통과");
  });

  // Case 5: no accepted claims
  it("Case 5 — analysisOutcome=no_accepted_claims: neutral-review / '수용된 발견 없음'", () => {
    const result = deriveDominantOutcome({
      status: "completed",
      analysisOutcome: "no_accepted_claims",
      qualityOutcome: "accepted",
    });
    expect(result.tone).toBe("neutral-review");
    expect(result.label).toBe("수용된 발견 없음");
  });

  // Case 6a: inconclusive
  it("Case 6a — inconclusive: caution-review / '분석 결론 불가'", () => {
    const result = deriveDominantOutcome({
      status: "completed",
      analysisOutcome: "inconclusive",
      qualityOutcome: "inconclusive",
    });
    expect(result.tone).toBe("caution-review");
    expect(result.label).toBe("분석 결론 불가");
  });

  // Case 6b: unknown/missing fields
  it("Case 6b — unknown/missing: fallback-review / '결과 상태 확인 필요'", () => {
    const result = deriveDominantOutcome({
      status: "completed",
    });
    expect(result.tone).toBe("fallback-review");
    expect(result.label).toBe("결과 상태 확인 필요");
  });

  // Forward-compat: unknown enum values
  it("forward-compat — unknown qualityOutcome enum → fallback-review", () => {
    const result = deriveDominantOutcome({
      status: "completed",
      analysisOutcome: "accepted_claims",
      qualityOutcome: "future_unknown_gate" as never,
    });
    expect(result.tone).toBe("fallback-review");
  });
});
