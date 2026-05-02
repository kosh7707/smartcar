import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilesHighlightedCode } from "./FilesHighlightedCode";

describe("FilesHighlightedCode", () => {
  it("renders empty copy when no code is provided", () => {
    render(<FilesHighlightedCode code="" />);
    expect(screen.getByText("파일을 선택하면 내용을 볼 수 있습니다.")).toBeInTheDocument();
  });

  it("renders line numbers and highlights requested lines", () => {
    const { container } = render(
      <FilesHighlightedCode code={"first\nsecond"} language="C" highlightLineNos={new Set([2])} />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(container.querySelector(".highlighted-code__line--highlighted")).not.toBeNull();
  });
});
