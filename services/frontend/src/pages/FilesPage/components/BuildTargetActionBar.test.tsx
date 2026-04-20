import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BuildTargetActionBar } from "./BuildTargetActionBar";

describe("BuildTargetActionBar", () => {
  it("renders discovery and add actions and starts pipeline when enabled", () => {
    const onDiscover = vi.fn();
    const onOpenAddForm = vi.fn();
    const onRunPipeline = vi.fn();

    render(
      <BuildTargetActionBar
        discovering={false}
        isRunning={false}
        hasTargets
        configuredCount={2}
        formLocked={false}
        onDiscover={onDiscover}
        onOpenAddForm={onOpenAddForm}
        onRunPipeline={onRunPipeline}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /타겟 탐색/i }));
    fireEvent.click(screen.getByRole("button", { name: /타겟 추가/i }));
    fireEvent.click(screen.getByRole("button", { name: /빌드 & 분석 실행/i }));

    expect(onDiscover).toHaveBeenCalledTimes(1);
    expect(onOpenAddForm).toHaveBeenCalledTimes(1);
    expect(onRunPipeline).toHaveBeenCalledTimes(1);
  });

  it("disables actions when discovery or pipeline locks them", () => {
    render(
      <BuildTargetActionBar
        discovering
        isRunning
        hasTargets
        configuredCount={0}
        formLocked
        onDiscover={vi.fn()}
        onOpenAddForm={vi.fn()}
        onRunPipeline={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /타겟 탐색/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /타겟 추가/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /빌드 & 분석 실행/i })).toBeDisabled();
  });
});
