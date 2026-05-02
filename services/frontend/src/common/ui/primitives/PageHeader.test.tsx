import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders the plain project-surface variant with subtitle", () => {
    const { container } = render(
      <PageHeader
        surface="plain"
        title="Payments Platform"
        subtitle="Secure build and scan surface"
      />,
    );

    expect(container.querySelector(".page-header--plain")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Payments Platform" })).toBeInTheDocument();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("Secure build and scan surface")).toBeInTheDocument();
    expect(container.querySelector(".page-header__eyebrow")).toBeNull();
  });

  it("defaults to the plain project-surface variant when no surface is provided", () => {
    const { container } = render(<PageHeader title="정적 분석" />);

    expect(container.querySelector(".page-header--plain")).not.toBeNull();
    expect(container.querySelector(".page-header--card")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "정적 분석" })).toBeInTheDocument();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("still supports the explicit card variant for opt-in callers", () => {
    const { container } = render(<PageHeader surface="card" title="가입 요청 관리" />);

    expect(container.querySelector(".page-header--card")).not.toBeNull();
    expect(container.querySelector(".surface-panel")).not.toBeNull();
  });
});
