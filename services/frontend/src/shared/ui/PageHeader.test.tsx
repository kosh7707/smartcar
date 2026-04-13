import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders the plain project-surface variant with eyebrow and subtitle", () => {
    const { container } = render(
      <PageHeader
        surface="plain"
        eyebrow="프로젝트 개요"
        title="Payments Platform"
        subtitle="Secure build and scan surface"
      />,
    );

    expect(container.querySelector(".page-header--plain")).not.toBeNull();
    expect(screen.getByText("프로젝트 개요")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Payments Platform" })).toBeInTheDocument();
    expect(screen.getByText("Secure build and scan surface")).toBeInTheDocument();
  });

  it("renders the default card variant when no surface is provided", () => {
    const { container } = render(<PageHeader title="정적 분석" />);

    expect(container.querySelector(".page-header--card")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "정적 분석" })).toBeInTheDocument();
  });
});
