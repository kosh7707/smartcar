import { describe, expect, it } from "vitest";
import { AnalysisTracker } from "../analysis-tracker";

describe("AnalysisTracker", () => {
  it("exposes websocket snapshot only after progress advances beyond queued", () => {
    const tracker = new AnalysisTracker();
    tracker.start("analysis-1", "project-1");

    expect(tracker.getWsSnapshot("analysis-1")).toBeUndefined();

    tracker.update("analysis-1", {
      phase: "deep_submitting",
      message: "심층 분석 에이전트 호출 중...",
    });

    expect(tracker.getWsSnapshot("analysis-1")).toEqual({
      type: "analysis-progress",
      payload: {
        analysisId: "analysis-1",
        phase: "deep_submitting",
        message: "심층 분석 에이전트 호출 중...",
      },
    });
  });

  it("preserves deep_complete phase on completion for REST/WS recovery", () => {
    const tracker = new AnalysisTracker();
    tracker.start("analysis-2", "project-2");
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
        phase: "deep_complete",
        message: "심층 분석 완료",
      },
    });
  });

  it("maps failed entries to analysis-error snapshots", () => {
    const tracker = new AnalysisTracker();
    tracker.start("analysis-3", "project-3");
    tracker.update("analysis-3", {
      phase: "quick_sast",
      message: "SAST 스캔 시작",
    });

    tracker.fail("analysis-3", "boom");

    expect(tracker.getWsSnapshot("analysis-3")).toEqual({
      type: "analysis-error",
      payload: {
        analysisId: "analysis-3",
        phase: "quick",
        error: "boom",
        retryable: false,
      },
    });
  });
});
