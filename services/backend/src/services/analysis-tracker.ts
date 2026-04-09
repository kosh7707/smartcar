import type { AnalysisPhase, AnalysisTrackerStatus, AnalysisProgress, WsAnalysisMessage } from "@aegis/shared";
import { createLogger } from "../lib/logger";

const logger = createLogger("analysis-tracker");

const CLEANUP_DELAY_MS = 30 * 60 * 1000; // 30분

interface AnalysisEntry {
  analysisId: string;
  projectId: string;
  status: AnalysisTrackerStatus;
  phase: AnalysisPhase;
  currentChunk: number;
  totalChunks: number;
  totalFiles?: number;
  processedFiles?: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  error?: string;
  abortController: AbortController;
}

export class AnalysisTracker {
  private entries = new Map<string, AnalysisEntry>();

  start(analysisId: string, projectId: string): AbortController {
    // 동일 프로젝트 중복 차단
    const running = this.getRunning(projectId);
    if (running) {
      throw new Error(`Analysis already running for project ${projectId}: ${running.analysisId}`);
    }

    const abortController = new AbortController();
    const now = new Date().toISOString();

    this.entries.set(analysisId, {
      analysisId,
      projectId,
      status: "running",
      phase: "queued",
      currentChunk: 0,
      totalChunks: 0,
      message: "분석 대기 중...",
      startedAt: now,
      updatedAt: now,
      abortController,
    });

    logger.info({ analysisId, projectId }, "Analysis tracking started");
    return abortController;
  }

  update(analysisId: string, patch: Partial<Pick<AnalysisEntry, "phase" | "currentChunk" | "totalChunks" | "totalFiles" | "processedFiles" | "message">>): void {
    const entry = this.entries.get(analysisId);
    if (!entry) return;

    Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
  }

  complete(analysisId: string): void {
    const entry = this.entries.get(analysisId);
    if (!entry) return;

    const now = new Date().toISOString();
    entry.status = "completed";
    if (entry.phase === "queued") {
      entry.phase = "complete";
    }
    if (!entry.message || entry.message === "분석 대기 중...") {
      entry.message = "분석 완료";
    }
    entry.updatedAt = now;
    entry.endedAt = now;

    this.scheduleCleanup(analysisId);
    logger.info({ analysisId }, "Analysis tracking completed");
  }

  fail(analysisId: string, error: string): void {
    const entry = this.entries.get(analysisId);
    if (!entry) return;

    const now = new Date().toISOString();
    entry.status = "failed";
    entry.message = "분석 실패";
    entry.error = error;
    entry.updatedAt = now;
    entry.endedAt = now;

    this.scheduleCleanup(analysisId);
    logger.error({ analysisId, error }, "Analysis tracking failed");
  }

  abort(analysisId: string): boolean {
    const entry = this.entries.get(analysisId);
    if (!entry || entry.status !== "running") return false;

    entry.abortController.abort();
    const now = new Date().toISOString();
    entry.status = "aborted";
    entry.message = "분석 중단됨";
    entry.updatedAt = now;
    entry.endedAt = now;

    this.scheduleCleanup(analysisId);
    logger.info({ analysisId }, "Analysis tracking aborted");
    return true;
  }

  get(analysisId: string): AnalysisProgress | undefined {
    const entry = this.entries.get(analysisId);
    if (!entry) return undefined;
    return this.toProgress(entry);
  }

  getAll(): AnalysisProgress[] {
    const all = [...this.entries.values()];
    // running 우선, 최근 순
    all.sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return all.map((e) => this.toProgress(e));
  }

  getRunning(projectId: string): AnalysisProgress | undefined {
    for (const entry of this.entries.values()) {
      if (entry.projectId === projectId && entry.status === "running") {
        return this.toProgress(entry);
      }
    }
    return undefined;
  }

  getWsSnapshot(analysisId: string): WsAnalysisMessage | undefined {
    const entry = this.entries.get(analysisId);
    if (!entry) return undefined;

    if (entry.status === "failed") {
      return {
        type: "analysis-error",
        payload: {
          analysisId,
          phase: this.toErrorPhase(entry.phase),
          error: entry.error ?? entry.message,
          retryable: false,
        },
      };
    }

    if (entry.status === "aborted" || entry.phase === "queued") {
      return undefined;
    }

    return {
      type: "analysis-progress",
      payload: {
        analysisId,
        phase: this.toWsPhase(entry.phase),
        message: entry.message,
      },
    };
  }

  private toProgress(entry: AnalysisEntry): AnalysisProgress {
    return {
      analysisId: entry.analysisId,
      projectId: entry.projectId,
      status: entry.status,
      phase: entry.phase,
      currentChunk: entry.currentChunk,
      totalChunks: entry.totalChunks,
      ...(entry.totalFiles != null ? { totalFiles: entry.totalFiles } : {}),
      ...(entry.processedFiles != null ? { processedFiles: entry.processedFiles } : {}),
      message: entry.message,
      startedAt: entry.startedAt,
      updatedAt: entry.updatedAt,
      endedAt: entry.endedAt,
      error: entry.error,
    };
  }

  private scheduleCleanup(analysisId: string): void {
    setTimeout(() => {
      this.entries.delete(analysisId);
      logger.debug({ analysisId }, "Analysis tracking entry cleaned up");
    }, CLEANUP_DELAY_MS);
  }

  private toWsPhase(phase: AnalysisPhase): "quick_sast" | "quick_complete" | "deep_submitting" | "deep_analyzing" | "deep_retrying" | "deep_complete" {
    switch (phase) {
      case "quick_sast":
        return "quick_sast";
      case "deep_submitting":
        return "deep_submitting";
      case "deep_analyzing":
        return "deep_analyzing";
      case "deep_complete":
      case "complete":
        return "deep_complete";
      case "rule_engine":
      case "llm_chunk":
      case "merging":
        return "deep_analyzing";
      case "queued":
        return "quick_sast";
    }
    return "deep_analyzing";
  }

  private toErrorPhase(phase: AnalysisPhase): "quick" | "deep" {
    if (phase === "quick_sast" || phase === "queued") {
      return "quick";
    }
    return "deep";
  }
}

export const analysisTracker = new AnalysisTracker();
