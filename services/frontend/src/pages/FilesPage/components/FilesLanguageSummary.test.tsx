import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilesLanguageSummary } from "./FilesLanguageSummary";

describe("FilesLanguageSummary", () => {
  it("renders nothing when there are no language stats", () => {
    const { container } = render(<FilesLanguageSummary totalFiles={0} langStats={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders summary segments and legend items", () => {
    render(
      <FilesLanguageSummary
        totalFiles={4}
        langStats={[
          { group: "C/C++", count: 3, color: "rgb(255, 0, 0)" },
          { group: "Markdown", count: 1, color: "rgb(0, 0, 255)" },
        ]}
      />,
    );

    expect(screen.getByText("C/C++")).toBeInTheDocument();
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
