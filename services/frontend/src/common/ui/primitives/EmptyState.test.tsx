import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";
import React from "react";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="데이터 없음" />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="T" description="설명 텍스트" />);
    expect(screen.getByText("설명 텍스트")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<EmptyState title="T" />);
    expect(container.querySelector(".empty-state__desc")).toBeNull();
  });

  it("renders action when provided", () => {
    render(<EmptyState title="T" action={<button>Action</button>} />);
    expect(screen.getByText("Action")).toBeInTheDocument();
  });

  it("renders compact variant", () => {
    const { container } = render(<EmptyState title="Compact" compact />);
    expect(container.querySelector(".empty-state--compact")).not.toBeNull();
    expect(container.querySelector(".empty-state.card")).toBeNull();
  });
});
