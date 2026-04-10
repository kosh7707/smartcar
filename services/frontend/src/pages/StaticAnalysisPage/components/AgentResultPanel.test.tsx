import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentResultPanel } from "./AgentResultPanel";
import type { AnalysisResult } from "@aegis/shared";

// Mock CSS import
vi.mock("./AgentResultPanel.css", () => ({}));

const baseResult: AnalysisResult = {
  id: "ar-1",
  projectId: "p-1",
  createdAt: "2026-03-25T10:00:00Z",
  results: [],
} as unknown as AnalysisResult;

describe("AgentResultPanel", () => {
  it("renders nothing when no agent data present", () => {
    const { container } = render(<AgentResultPanel analysisResult={baseResult} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders confidence score with percentage", () => {
    const result = {
      ...baseResult,
      confidenceScore: 0.875,
      confidenceBreakdown: {
        grounding: 0.9,
        deterministicSupport: 0.85,
        ragCoverage: 0.8,
        schemaCompliance: 0.95,
      },
    };

    render(<AgentResultPanel analysisResult={result} />);

    expect(screen.getByText("87.5%")).toBeTruthy();
    expect(screen.getByText("신뢰도")).toBeTruthy();
    expect(screen.getByText("증적 근거")).toBeTruthy();
    expect(screen.getByText("결정론적 뒷받침")).toBeTruthy();
  });

  it("shows 검토 필요 badge when needsHumanReview is true", () => {
    const result = {
      ...baseResult,
      confidenceScore: 0.4,
      needsHumanReview: true,
    };

    render(<AgentResultPanel analysisResult={result} />);

    expect(screen.getByText("검토 필요")).toBeTruthy();
  });

  it("renders caveats list", () => {
    const result = {
      ...baseResult,
      caveats: ["빌드 실패로 정적 분석 불완전", "CVE-2024-1234 미확인"],
    };

    render(<AgentResultPanel analysisResult={result} />);

    expect(screen.getByText(/분석 한계/)).toBeTruthy();
    expect(screen.getByText(/빌드 실패로 정적 분석 불완전/)).toBeTruthy();
  });

  it("toggles agent audit section", () => {
    const result = {
      ...baseResult,
      agentAudit: {
        latencyMs: 12500,
        tokenUsage: { prompt: 8000, completion: 2000 },
        turnCount: 3,
        toolCallCount: 7,
        terminationReason: "normal",
      },
    };

    render(<AgentResultPanel analysisResult={result} />);

    // Audit section initially closed
    expect(screen.queryByText("12.5초")).toBeNull();

    // Open audit section
    fireEvent.click(screen.getByText("에이전트 실행 정보"));

    expect(screen.getByText("12.5초")).toBeTruthy();
    expect(screen.getByText("8,000")).toBeTruthy();
    expect(screen.getByText("2,000")).toBeTruthy();
    expect(screen.getByText("7회")).toBeTruthy();
  });
});
