import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HighlightedCode } from "./HighlightedCode";

describe("HighlightedCode", () => {
  it("renders empty copy when no code is provided", () => {
    render(<HighlightedCode code="" />);
    expect(screen.getByText("파일을 선택하면 내용을 볼 수 있습니다.")).toBeInTheDocument();
  });

  it("renders line numbers and highlights requested lines", () => {
    const { container } = render(
      <HighlightedCode code={"first\nsecond"} language="C" highlightLineNos={new Set([2])} />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(container.querySelector(".highlighted-code__line--highlighted")).not.toBeNull();
  });
});
