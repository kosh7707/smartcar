import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecoveryTracePanel } from "./RecoveryTracePanel";
import type { AgentRecoveryTraceEntry } from "@aegis/shared";

const singleEntry: AgentRecoveryTraceEntry[] = [
  {
    deficiency: "클레임 증거 불충분",
    action: "증거 재수집 시도",
    outcome: "부분 성공",
    detail: "RAG 재조회 후 2개 증거 추가",
  },
];

const multiEntry: AgentRecoveryTraceEntry[] = [
  {
    deficiency: "클레임 A 근거 없음",
    action: "소스 재분석",
    outcome: "실패",
  },
  {
    deficiency: "클레임 B 형식 오류",
    action: "포맷 교정",
    outcome: "성공",
    detail: "JSON 스키마 보정 완료",
  },
  {
    action: "최종 검증",
    outcome: "통과",
  },
];

// ── empty / null ──

describe("RecoveryTracePanel — empty/null guard", () => {
  it("returns null when trace is undefined", () => {
    const { container } = render(<RecoveryTracePanel />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when trace is empty array", () => {
    const { container } = render(<RecoveryTracePanel trace={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

// ── compact variant ──

describe("RecoveryTracePanel — compact variant", () => {
  it("single entry: shows entry text inline", () => {
    render(<RecoveryTracePanel trace={singleEntry} variant="compact" />);
    expect(screen.getByText("복구")).toBeInTheDocument();
    expect(screen.getByText("증거 재수집 시도")).toBeInTheDocument();
  });

  it("multiple entries: shows '복구 N회' chip", () => {
    render(<RecoveryTracePanel trace={multiEntry} variant="compact" />);
    expect(screen.getByText(`복구 ${multiEntry.length}회`)).toBeInTheDocument();
  });

  it("wraps in recovery-trace-panel element", () => {
    const { container } = render(
      <RecoveryTracePanel trace={singleEntry} variant="compact" />,
    );
    expect(container.querySelector(".recovery-trace-panel")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <RecoveryTracePanel
        trace={singleEntry}
        variant="compact"
        className="my-custom-class"
      />,
    );
    expect(
      container.querySelector(".recovery-trace-panel.my-custom-class"),
    ).toBeInTheDocument();
  });
});

// ── expanded variant (default) ──

describe("RecoveryTracePanel — expanded variant (default)", () => {
  it("renders all entries in expanded mode", () => {
    render(<RecoveryTracePanel trace={multiEntry} />);
    const entries = document.querySelectorAll(".recovery-trace-entry");
    expect(entries).toHaveLength(multiEntry.length);
  });

  it("shows deficiency, action, outcome, detail field labels when present", () => {
    render(<RecoveryTracePanel trace={singleEntry} />);
    expect(screen.getByText("결함")).toBeInTheDocument();
    expect(screen.getByText("조치")).toBeInTheDocument();
    expect(screen.getByText("결과")).toBeInTheDocument();
    expect(screen.getByText("상세")).toBeInTheDocument();
  });

  it("shows field values for a full entry", () => {
    render(<RecoveryTracePanel trace={singleEntry} />);
    expect(screen.getByText("클레임 증거 불충분")).toBeInTheDocument();
    expect(screen.getByText("증거 재수집 시도")).toBeInTheDocument();
    expect(screen.getByText("부분 성공")).toBeInTheDocument();
    expect(screen.getByText("RAG 재조회 후 2개 증거 추가")).toBeInTheDocument();
  });

  it("uses activity-item class for timeline rail", () => {
    render(<RecoveryTracePanel trace={singleEntry} />);
    expect(document.querySelector(".activity-item")).toBeInTheDocument();
  });

  it("numbers each step", () => {
    render(<RecoveryTracePanel trace={multiEntry} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

// ── partial fields (graceful) ──

describe("RecoveryTracePanel — partial fields graceful", () => {
  it("entry with only action renders without crashing", () => {
    const partial: AgentRecoveryTraceEntry[] = [{ action: "조치만 있음" }];
    render(<RecoveryTracePanel trace={partial} />);
    expect(screen.getByText("조치만 있음")).toBeInTheDocument();
    expect(screen.queryByText("결함")).not.toBeInTheDocument();
    expect(screen.queryByText("결과")).not.toBeInTheDocument();
  });

  it("entry with only deficiency renders without crashing", () => {
    const partial: AgentRecoveryTraceEntry[] = [
      { deficiency: "결함만 있음" },
    ];
    render(<RecoveryTracePanel trace={partial} />);
    expect(screen.getByText("결함만 있음")).toBeInTheDocument();
    expect(screen.queryByText("조치")).not.toBeInTheDocument();
  });

  it("entry with all fields absent renders entry container but no field rows", () => {
    const partial: AgentRecoveryTraceEntry[] = [{}];
    render(<RecoveryTracePanel trace={partial} />);
    const entries = document.querySelectorAll(".recovery-trace-entry");
    expect(entries).toHaveLength(1);
    expect(screen.queryByText("결함")).not.toBeInTheDocument();
    expect(screen.queryByText("조치")).not.toBeInTheDocument();
  });

  it("compact single entry with no action falls back to deficiency text", () => {
    const partial: AgentRecoveryTraceEntry[] = [
      { deficiency: "결함 텍스트" },
    ];
    render(<RecoveryTracePanel trace={partial} variant="compact" />);
    expect(screen.getByText("결함 텍스트")).toBeInTheDocument();
  });
});
