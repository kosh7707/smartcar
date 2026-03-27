/**
 * 프로젝트 활동 타임라인 서비스
 *
 * 여러 데이터 소스(Run, AuditLog, BuildTarget)에서
 * 최근 활동을 수집·병합하여 단일 타임라인으로 반환한다.
 */
import type { IRunDAO, IAuditLogDAO, IBuildTargetDAO } from "../dao/interfaces";

export type ActivityType =
  | "run_completed"
  | "finding_status_changed"
  | "approval_decided"
  | "pipeline_completed";

export interface ActivityEntry {
  type: ActivityType;
  timestamp: string;
  summary: string;
  metadata: Record<string, unknown>;
}

export class ActivityService {
  constructor(
    private runDAO: IRunDAO,
    private auditLogDAO: IAuditLogDAO,
    private buildTargetDAO: IBuildTargetDAO,
  ) {}

  getTimeline(projectId: string, limit = 10): ActivityEntry[] {
    const entries: ActivityEntry[] = [];

    // 1. 최근 완료된 분석 Run
    const runs = this.runDAO.findByProjectId(projectId);
    for (const run of runs.slice(0, limit)) {
      if (run.status !== "completed" && run.status !== "failed") continue;
      entries.push({
        type: "run_completed",
        timestamp: run.endedAt ?? run.createdAt,
        summary: `분석 ${run.status === "completed" ? "완료" : "실패"} (${run.module}, ${run.findingCount}건)`,
        metadata: { runId: run.id, module: run.module, findingCount: run.findingCount, status: run.status },
      });
    }

    // 2. Finding 상태 변경
    const statusChanges = this.auditLogDAO.findFindingStatusChanges(projectId, limit);
    for (const log of statusChanges) {
      const detail = log.detail as { from?: string; to?: string; reason?: string };
      entries.push({
        type: "finding_status_changed",
        timestamp: log.timestamp,
        summary: `${log.actor}가 Finding 상태 변경 (${detail.from ?? "?"} → ${detail.to ?? "?"})`,
        metadata: { findingId: log.resourceId, actor: log.actor, from: detail.from, to: detail.to, reason: detail.reason },
      });
    }

    // 3. Approval 결정
    const approvalDecisions = this.auditLogDAO.findApprovalDecisions(projectId, limit);
    for (const log of approvalDecisions) {
      const detail = log.detail as { decision?: string; actionType?: string };
      entries.push({
        type: "approval_decided",
        timestamp: log.timestamp,
        summary: `${log.actor}가 ${detail.decision ?? log.action} (${detail.actionType ?? ""})`,
        metadata: { approvalId: log.resourceId, actor: log.actor, decision: detail.decision, actionType: detail.actionType },
      });
    }

    // 4. 파이프라인 완료 (ready 상태 타겟)
    const targets = this.buildTargetDAO.findByProjectId(projectId);
    for (const t of targets) {
      if (t.status === "ready" && t.updatedAt) {
        entries.push({
          type: "pipeline_completed",
          timestamp: t.updatedAt,
          summary: `'${t.name}' 빌드 파이프라인 완료`,
          metadata: { targetId: t.id, targetName: t.name },
        });
      }
    }

    // 병합: timestamp DESC 정렬 후 limit 적용
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries.slice(0, limit);
  }
}
