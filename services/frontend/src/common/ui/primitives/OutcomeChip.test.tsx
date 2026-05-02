import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutcomeChip } from "./OutcomeChip";

describe("OutcomeChip — analysis kind", () => {
  it("accepted_claims → '유효 발견 있음' + positive tone", () => {
    render(<OutcomeChip kind="analysis" value="accepted_claims" />);
    const el = screen.getByText("유효 발견 있음").closest(".outcome-chip")!;
    expect(el).toBeTruthy();
    expect(el.className).toContain("outcome-chip--positive");
  });

  it("no_accepted_claims → '수용된 발견 없음' + neutral-review tone", () => {
    render(<OutcomeChip kind="analysis" value="no_accepted_claims" />);
    const el = screen.getByText("수용된 발견 없음").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--neutral-review");
  });

  it("inconclusive → '결론 불가' + caution-review tone", () => {
    render(<OutcomeChip kind="analysis" value="inconclusive" />);
    const el = screen.getByText("결론 불가").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--caution-review");
  });
});

describe("OutcomeChip — quality kind", () => {
  it("accepted → '품질 통과' + positive tone", () => {
    render(<OutcomeChip kind="quality" value="accepted" />);
    const el = screen.getByText("품질 통과").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--positive");
  });

  it("accepted_with_caveats → '조건부 품질 통과' + caution-review tone", () => {
    render(<OutcomeChip kind="quality" value="accepted_with_caveats" />);
    const el = screen.getByText("조건부 품질 통과").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--caution-review");
  });

  it("rejected → '품질 게이트 실패' + critical-review tone", () => {
    render(<OutcomeChip kind="quality" value="rejected" />);
    const el = screen.getByText("품질 게이트 실패").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--critical-review");
  });

  it("inconclusive → '품질 결론 불가' + caution-review tone", () => {
    render(<OutcomeChip kind="quality" value="inconclusive" />);
    const el = screen.getByText("품질 결론 불가").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--caution-review");
  });

  it("repair_exhausted → '복구 한도 초과' + critical-review tone", () => {
    render(<OutcomeChip kind="quality" value="repair_exhausted" />);
    const el = screen.getByText("복구 한도 초과").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--critical-review");
  });
});

describe("OutcomeChip — poc kind", () => {
  it("poc_accepted → 'PoC 재현 성공' + positive tone", () => {
    render(<OutcomeChip kind="poc" value="poc_accepted" />);
    const el = screen.getByText("PoC 재현 성공").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--positive");
  });

  it("poc_rejected → 'PoC 재현 실패' + critical-review tone", () => {
    render(<OutcomeChip kind="poc" value="poc_rejected" />);
    const el = screen.getByText("PoC 재현 실패").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--critical-review");
  });

  it("poc_inconclusive → 'PoC 결론 불가' + caution-review tone", () => {
    render(<OutcomeChip kind="poc" value="poc_inconclusive" />);
    const el = screen.getByText("PoC 결론 불가").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--caution-review");
  });

  it("poc_not_requested → 'PoC 미요청' + neutral-review tone", () => {
    render(<OutcomeChip kind="poc" value="poc_not_requested" />);
    const el = screen.getByText("PoC 미요청").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--neutral-review");
  });
});

describe("OutcomeChip — cleanPass kind", () => {
  it("true → '분석 완료' + positive tone", () => {
    render(<OutcomeChip kind="cleanPass" value={true} />);
    const el = screen.getByText("분석 완료").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--positive");
  });

  it("false → '결과 검토 필요' + caution-review tone", () => {
    render(<OutcomeChip kind="cleanPass" value={false} />);
    const el = screen.getByText("결과 검토 필요").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--caution-review");
  });

  it("null → '결과 상태 확인 필요' + fallback-review tone", () => {
    render(<OutcomeChip kind="cleanPass" value={null} />);
    const el = screen.getByText("결과 상태 확인 필요").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--fallback-review");
  });

  it("undefined → '결과 상태 확인 필요' + fallback-review tone", () => {
    render(<OutcomeChip kind="cleanPass" value={undefined} />);
    const el = screen.getByText("결과 상태 확인 필요").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--fallback-review");
  });
});

describe("OutcomeChip — override props", () => {
  it("tone override wins over auto-resolved tone", () => {
    render(<OutcomeChip kind="quality" value="accepted" tone="neutral-review" />);
    const el = screen.getByText("품질 통과").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--neutral-review");
    expect(el.className).not.toContain("outcome-chip--positive");
  });

  it("label override wins over resolved label", () => {
    render(<OutcomeChip kind="quality" value="accepted" label="커스텀 라벨" />);
    expect(screen.getByText("커스텀 라벨")).toBeInTheDocument();
    expect(screen.queryByText("품질 통과")).not.toBeInTheDocument();
  });
});

describe("OutcomeChip — size variants", () => {
  it("default size is md", () => {
    render(<OutcomeChip kind="quality" value="accepted" />);
    const el = screen.getByText("품질 통과").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--md");
  });

  it("size=sm adds outcome-chip--sm class", () => {
    render(<OutcomeChip kind="quality" value="accepted" size="sm" />);
    const el = screen.getByText("품질 통과").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--sm");
    expect(el.className).not.toContain("outcome-chip--md");
  });
});

describe("OutcomeChip — showDot", () => {
  it("showDot=false renders no dot element (default)", () => {
    render(<OutcomeChip kind="quality" value="accepted" />);
    expect(document.querySelector(".outcome-chip__dot")).not.toBeInTheDocument();
  });

  it("showDot=true renders dot element", () => {
    render(<OutcomeChip kind="quality" value="accepted" showDot />);
    expect(document.querySelector(".outcome-chip__dot")).toBeInTheDocument();
  });
});

describe("OutcomeChip — forward-compat (unknown enum)", () => {
  it("unknown string value → fallback-review tone", () => {
    // Cast to bypass type check — simulates future unknown enum
    render(<OutcomeChip kind="analysis" value={"future_unknown_value" as never} />);
    const el = screen.getByText("결과 상태 확인 필요").closest(".outcome-chip")!;
    expect(el.className).toContain("outcome-chip--fallback-review");
  });
});
