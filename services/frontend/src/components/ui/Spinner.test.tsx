import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("renders without label", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders with label", () => {
    render(<Spinner label="로딩 중..." />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("does not render label span when no label provided", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});
