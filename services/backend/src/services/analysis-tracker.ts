import type { AnalysisPhase, AnalysisTrackerStatus, AnalysisProgress } from "@smartcar/shared";
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

  update(analysisId: string, patch: Partial<Pick<AnalysisEntry, "phase" | "currentChunk" | "totalChunks" | "message">>): void {
    const entry = this.entries.get(analysisId);
    if (!entry) return;

    Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
  }

  complete(analysisId: string): void {
    const entry = this.entries.get(analysisId);
    if (!entry) return;

    const now = new Date().toISOString();
    entry.status = "completed";
    entry.phase = "complete";
    entry.message = "분석 완료";
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

  private toProgress(entry: AnalysisEntry): AnalysisProgress {
    return {
      analysisId: entry.analysisId,
      projectId: entry.projectId,
      status: entry.status,
      phase: entry.phase,
      currentChunk: entry.currentChunk,
      totalChunks: entry.totalChunks,
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
}

export const analysisTracker = new AnalysisTracker();
