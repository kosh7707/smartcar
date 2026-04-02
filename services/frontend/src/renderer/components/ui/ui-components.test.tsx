import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { SeverityBadge } from "./SeverityBadge";
import { SourceBadge } from "./SourceBadge";
import { Spinner } from "./Spinner";
import { EmptyState } from "./EmptyState";

describe("SeverityBadge", () => {
  it("renders severity text uppercased", () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
  });

  it("applies sm size class", () => {
    const { container } = render(<SeverityBadge severity="high" size="sm" />);
    expect(container.querySelector(".badge-sm")).toBeInTheDocument();
  });

  it("applies severity class", () => {
    const { container } = render(<SeverityBadge severity="medium" />);
    expect(container.querySelector(".badge-medium")).toBeInTheDocument();
  });
});

describe("SourceBadge", () => {
  it("renders label for rule-engine", () => {
    render(<SourceBadge sourceType="rule-engine" />);
    expect(screen.getByText(/룰/)).toBeInTheDocument();
  });

  it("shows ruleId for rule-engine when provided", () => {
    render(<SourceBadge sourceType="rule-engine" ruleId="CWE-78" />);
    expect(screen.getByText("룰 엔진: CWE-78")).toBeInTheDocument();
  });

  it("renders label for agent", () => {
    render(<SourceBadge sourceType="agent" />);
    expect(screen.getByText("심층 에이전트")).toBeInTheDocument();
  });

  it("renders label for sast-tool", () => {
    render(<SourceBadge sourceType="sast-tool" />);
    expect(screen.getByText("SAST 도구")).toBeInTheDocument();
  });

  it("has title attribute with description", () => {
    const { container } = render(<SourceBadge sourceType="llm-assist" />);
    const badge = container.querySelector(".badge");
    expect(badge).toHaveAttribute("title");
  });
});

describe("Spinner", () => {
  it("renders without label", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders with label", () => {
    render(<Spinner label="로딩 중..." />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="데이터 없음" />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="빈 상태" description="설명 텍스트" />);
    expect(screen.getByText("설명 텍스트")).toBeInTheDocument();
  });

  it("renders compact variant", () => {
    const { container } = render(<EmptyState title="축약" compact />);
    expect(container.querySelector(".empty-state--compact")).toBeInTheDocument();
  });

  it("does not show description in compact mode", () => {
    render(<EmptyState title="축약" description="숨김" compact />);
    expect(screen.queryByText("숨김")).not.toBeInTheDocument();
  });

  it("renders action button", () => {
    render(<EmptyState title="빈 상태" action={<button>추가</button>} />);
    expect(screen.getByText("추가")).toBeInTheDocument();
  });
});
