import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { NonAcceptedClaim } from "@aegis/shared";
import { NonAcceptedClaimsList, sortClaims, statusToReviewTone } from "./NonAcceptedClaimsList";

describe("statusToReviewTone", () => {
  it("maps strong negative lifecycle stages to critical-review", () => {
    expect(statusToReviewTone("rejected")).toBe("critical-review");
    expect(statusToReviewTone("repair_exhausted")).toBe("critical-review");
  });

  it("maps in-progress / inconclusive lifecycle stages to caution-review", () => {
    expect(statusToReviewTone("under_evidenced")).toBe("caution-review");
    expect(statusToReviewTone("needs_human_review")).toBe("caution-review");
    expect(statusToReviewTone("retried")).toBe("caution-review");
    expect(statusToReviewTone("inconclusive")).toBe("caution-review");
    expect(statusToReviewTone("candidate")).toBe("caution-review");
  });

  it("maps withdrawn to neutral-review and unknown to fallback-review", () => {
    expect(statusToReviewTone("withdrawn")).toBe("neutral-review");
    expect(statusToReviewTone("future_unknown_stage")).toBe("fallback-review");
  });
});

describe("sortClaims", () => {
  it("orders by lifecycle priority, then retryCount desc", () => {
    const claims: NonAcceptedClaim[] = [
      { status: "withdrawn" },
      { status: "rejected", retryCount: 1 },
      { status: "inconclusive" },
      { status: "rejected", retryCount: 5 },
      { status: "repair_exhausted" },
      { status: "candidate" },
    ];
    const sorted = sortClaims(claims).map((c) => ({ status: c.status, retry: c.retryCount }));
    expect(sorted).toEqual([
      { status: "rejected", retry: 5 },
      { status: "rejected", retry: 1 },
      { status: "repair_exhausted", retry: undefined },
      { status: "inconclusive", retry: undefined },
      { status: "candidate", retry: undefined },
      { status: "withdrawn", retry: undefined },
    ]);
  });

  it("does not mutate the input array", () => {
    const input: NonAcceptedClaim[] = [{ status: "candidate" }, { status: "rejected" }];
    const snapshot = input.map((c) => c.status);
    sortClaims(input);
    expect(input.map((c) => c.status)).toEqual(snapshot);
  });
});

describe("<NonAcceptedClaimsList>", () => {
  const claims: NonAcceptedClaim[] = [
    {
      claimId: "claim-0",
      status: "under_evidenced",
      family: "command_injection",
      primaryLocation: "src/main.c:42",
      rejectionCode: "evidence_missing",
      rejectionReason: "missing required sink evidence",
      statement: "user-controlled input reaches system",
      retryCount: 2,
      severity: "high",
      requiredEvidence: ["local_or_derived_support", "sink_or_dangerous_api"],
      presentEvidence: ["local_or_derived_support"],
      missingEvidence: ["sink_or_dangerous_api"],
      outcomeContribution: "no_accepted_claims",
    },
  ];

  it("renders claim head with status label, severity, family, and rejection code", () => {
    render(<NonAcceptedClaimsList claims={claims} />);
    expect(screen.getByText("증거 부족")).toBeTruthy();
    expect(screen.getByText("command_injection")).toBeTruthy();
    expect(screen.getByText("evidence_missing")).toBeTruthy();
    expect(screen.getByText("user-controlled input reaches system")).toBeTruthy();
    expect(screen.getByText("src/main.c:42")).toBeTruthy();
    expect(screen.getByText("retry 2")).toBeTruthy();
  });

  it("expands the body and shows reason / evidence breakdown when toggled", () => {
    render(<NonAcceptedClaimsList claims={claims} />);
    const head = screen.getByRole("button", { expanded: false });
    fireEvent.click(head);
    expect(screen.getByText(/missing required sink evidence/)).toBeTruthy();
    expect(screen.getByText("no_accepted_claims")).toBeTruthy();
    expect(screen.getByText("sink_or_dangerous_api")).toBeTruthy();
  });

  it("renders an empty list with no row buttons when claims is []", () => {
    render(<NonAcceptedClaimsList claims={[]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("falls back to index-based key when claimId is absent", () => {
    const anonClaims: NonAcceptedClaim[] = [
      { status: "rejected", statement: "first" },
      { status: "rejected", statement: "second" },
    ];
    render(<NonAcceptedClaimsList claims={anonClaims} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
  });
});
