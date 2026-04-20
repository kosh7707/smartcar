import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { EvidenceRef } from "@aegis/shared";
import { EvidencePanel } from "./EvidencePanel";

function makeEvidence(index: number): EvidenceRef {
  return {
    id: `evidence-${index}`,
    findingId: "finding-1",
    artifactId: `artifact-${index}`,
    artifactType: index % 2 === 0 ? "analysis-result" : "uploaded-file",
    locatorType: "line-range",
    locator: {
      startLine: index,
      endLine: index + 1,
    },
    createdAt: `2026-04-${String(index).padStart(2, "0")}T01:00:00Z`,
  };
}

describe("EvidencePanel", () => {
  it("renders the compact empty state", () => {
    render(<EvidencePanel evidenceRefs={[]} />);

    expect(screen.getByText("증적 (0)")).toBeInTheDocument();
    expect(screen.getByText("연결된 증적이 없습니다")).toBeInTheDocument();
  });

  it("collapses long evidence lists and expands on demand", () => {
    const evidenceRefs = Array.from({ length: 7 }, (_, index) => makeEvidence(index + 1));

    render(<EvidencePanel evidenceRefs={evidenceRefs} />);

    expect(screen.getByText("증적 (7)")).toBeInTheDocument();
    expect(screen.getByText("나머지 2건 더 보기")).toBeInTheDocument();
    expect(screen.getAllByText(/소스 코드/)).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /나머지 2건 더 보기/i }));

    expect(screen.getAllByText(/소스 코드/)).toHaveLength(7);
    expect(screen.getByRole("button", { name: "접기" })).toBeInTheDocument();
  });

  it("forwards evidence selection when a row is clicked", () => {
    const evidenceRefs = [makeEvidence(1)];
    const handleSelect = vi.fn();

    render(<EvidencePanel evidenceRefs={evidenceRefs} onSelectEvidence={handleSelect} />);

    fireEvent.click(screen.getByText("소스 코드"));

    expect(handleSelect).toHaveBeenCalledWith(evidenceRefs[0]);
  });
});
