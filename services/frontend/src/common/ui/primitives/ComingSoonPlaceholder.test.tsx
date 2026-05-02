import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoonPlaceholder } from "./ComingSoonPlaceholder";

describe("ComingSoonPlaceholder", () => {
  it("renders title with '준비 중' suffix", () => {
    render(<ComingSoonPlaceholder title="동적 분석" />);
    expect(screen.getByText("동적 분석 — 준비 중")).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(<ComingSoonPlaceholder title="테스트" />);
    expect(screen.getByText("이 기능은 현재 개발 중입니다.")).toBeInTheDocument();
  });
});
