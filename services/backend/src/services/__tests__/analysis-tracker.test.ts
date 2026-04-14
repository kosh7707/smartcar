import { describe, expect, it } from "vitest";
import { AnalysisTracker } from "../analysis-tracker";

describe("AnalysisTracker", () => {
  it("exposes websocket snapshot only after progress advances beyond queued", () => {
    const tracker = new AnalysisTracker();
    tracker.start("analysis-1", "project-1", {
      buildTargetId: "target-1",
      executionId: "exec-1",
    });

    expect(tracker.getWsSnapshot("analysis-1")).toBeUndefined();

    tracker.update("analysis-1", {
      phase: "deep_submitting",
      message: "심층 분석 에이전트 호출 중...",
    });

    expect(tracker.getWsSnapshot("analysis-1")).toEqual({
      type: "analysis-progress",
      payload: {
        analysisId: "analysis-1",
        buildTargetId: "target-1",
        executionId: "exec-1",
        phase: "deep_submitting",
        message: "심층 분석 에이전트 호출 중...",
      },
    });
  });

  it("preserves deep_complete phase on completion for REST/WS recovery", () => {
    const tracker = new AnalysisTracker();
    tracker.start("analysis-2", "project-2", {
      buildTargetId: "target-2",
      executionId: "exec-2",
    });
    tracker.update("analysis-2", {
      phase: "deep_complete",
      message: "심층 분석 완료",
    });

    tracker.complete("analysis-2");

    expect(tracker.get("analysis-2")).toMatchObject({
      status: "completed",
      phase: "deep_complete",
      message: "심층 분석 완료",
    });
    expect(tracker.getWsSnapshot("analysis-2")).toEqual({
      type: "analysis-progress",
      payload: {
        analysisId: "analysis-2",
        buildTargetId: "target-2",
        executionId: "exec-2",
        phase: "deep_complete",
        message: "심층 분석 완료",
      },
    });
  });

  it("maps failed entries to analysis-error snapshots", () => {
    const tracker = new AnalysisTracker();
    tracker.start("analysis-3", "project-3", {
      buildTargetId: "target-3",
      executionId: "exec-3",
    });
    tracker.update("analysis-3", {
      phase: "quick_sast",
      message: "SAST 스캔 시작",
    });

    tracker.fail("analysis-3", "boom");

    expect(tracker.getWsSnapshot("analysis-3")).toEqual({
      type: "analysis-error",
      payload: {
        analysisId: "analysis-3",
        buildTargetId: "target-3",
        executionId: "exec-3",
        phase: "quick",
        error: "boom",
        retryable: false,
      },
    });
  });

  it("preserves quick_graphing as a websocket progress phase", () => {
    const tracker = new AnalysisTracker();
    tracker.start("analysis-4", "project-4", {
      buildTargetId: "target-4",
      executionId: "exec-4",
    });
    tracker.update("analysis-4", {
      phase: "quick_graphing",
      message: "Quick 그래프 컨텍스트 적재 중...",
    });

    expect(tracker.getWsSnapshot("analysis-4")).toEqual({
      type: "analysis-progress",
      payload: {
        analysisId: "analysis-4",
        buildTargetId: "target-4",
        executionId: "exec-4",
        phase: "quick_graphing",
        message: "Quick 그래프 컨텍스트 적재 중...",
      },
    });
  });

  it("exposes BuildTarget and execution traceability in REST progress snapshots", () => {
    const tracker = new AnalysisTracker();
    tracker.start("analysis-5", "project-5", {
      buildTargetId: "target-5",
      executionId: "exec-5",
    });

    expect(tracker.get("analysis-5")).toMatchObject({
      analysisId: "analysis-5",
      projectId: "project-5",
      buildTargetId: "target-5",
      executionId: "exec-5",
      status: "running",
    });
  });
});
