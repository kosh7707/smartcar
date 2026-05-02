import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RunDetailView } from "../RunDetailView/RunDetailView";

vi.mock("../AgentResultPanel/AgentResultPanel", () => ({ AgentResultPanel: () => <div>agent-result-panel</div> }));
vi.mock("@/common/ui/primitives", async () => {
  const actual = await vi.importActual<typeof import("@/common/ui/primitives")>("@/common/ui/primitives");
  return {
    ...actual,
    GateResultCard: () => <div>gate-result-card</div>,
  };
});

const runDetail = {
  run: {
    id: "run-1a2b3c4d-xxxx",
    projectId: "project-1",
    module: "static_analysis",
    status: "completed",
    analysisResultId: "analysis-result-1",
    findingCount: 2,
    startedAt: "2026-04-10T01:00:00Z",
    endedAt: "2026-04-10T01:00:30Z",
    createdAt: "2026-04-10T01:00:00Z",
  },
  gate: {
    id: "gate-1",
    status: "pass",
    evaluatedAt: "2026-04-10T01:00:40Z",
    rules: [],
    runId: "run-1a2b3c4d-xxxx",
    projectId: "project-1",
    createdAt: "2026-04-10T01:00:40Z",
  },
  findings: [
    {
      finding: {
        id: "finding-1",
        severity: "critical",
        status: "open",
        sourceType: "rule-engine",
        title: "Critical auth bypass",
        location: "src/auth.ts:12",
        ruleId: "AUTH-001",
      },
      evidenceRefs: [],
    },
    {
      finding: {
        id: "finding-2",
        severity: "high",
        status: "fixed",
        sourceType: "llm-assist",
        title: "Weak crypto",
        location: "src/crypto.ts:22",
      },
      evidenceRefs: [],
    },
  ],
} as any;

describe("RunDetailView", () => {
  it("renders page header with run slug, meta sub, severity tally, gate, agent panel, and grouped findings", () => {
    render(
      <RunDetailView
        runDetail={runDetail}
        analysisResult={{ id: "analysis-result-1" } as any}
        projectId="project-1"
        onBack={vi.fn()}
        onSelectFinding={vi.fn()}
        onViewLegacyResult={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: /실행 상세/ })).toBeInTheDocument();
    expect(screen.getByText("RUN-run-1a2b")).toBeInTheDocument();
    expect(screen.getByText("STATUS")).toBeInTheDocument();
    expect(screen.getByText("DURATION")).toBeInTheDocument();
    expect(screen.getByText("30s")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /보안 현황/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /탐지 항목/ })).toBeInTheDocument();
    expect(screen.getByText("gate-result-card")).toBeInTheDocument();
    expect(screen.getByText("agent-result-panel")).toBeInTheDocument();
    expect(screen.getByText("src/auth.ts")).toBeInTheDocument();
    expect(screen.getByText("src/crypto.ts")).toBeInTheDocument();
    expect(screen.getByText("Critical auth bypass")).toBeInTheDocument();
    expect(screen.getByText("Weak crypto")).toBeInTheDocument();
  });

  it("opens legacy result and finding callbacks", () => {
    const onSelectFinding = vi.fn();
    const onViewLegacyResult = vi.fn();
    render(
      <RunDetailView
        runDetail={runDetail}
        analysisResult={null}
        projectId="project-1"
        onBack={vi.fn()}
        onSelectFinding={onSelectFinding}
        onViewLegacyResult={onViewLegacyResult}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "원본 분석 결과 보기" }));
    fireEvent.click(screen.getByText("Critical auth bypass"));

    expect(onViewLegacyResult).toHaveBeenCalledWith("analysis-result-1");
    expect(onSelectFinding).toHaveBeenCalledWith("finding-1");
  });
});
