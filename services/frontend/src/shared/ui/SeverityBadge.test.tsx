import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeverityBadge } from "./SeverityBadge";

describe("SeverityBadge", () => {
  it("renders severity in uppercase", () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
  });

  it("applies badge-severity class", () => {
    render(<SeverityBadge severity="high" />);
    const badge = screen.getByText("HIGH");
    expect(badge.className).toContain("badge-severity--high");
  });

  it("applies compact text class for sm size", () => {
    render(<SeverityBadge severity="medium" size="sm" />);
    const badge = screen.getByText("MEDIUM");
    expect(badge.className).toContain("text-xs");
  });

  it("defaults to md size", () => {
    render(<SeverityBadge severity="low" />);
    const badge = screen.getByText("LOW");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge.className).toContain("badge-severity--low");
  });

  it("handles info severity", () => {
    render(<SeverityBadge severity="info" />);
    expect(screen.getByText("INFO")).toBeInTheDocument();
  });
});
