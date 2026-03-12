import crypto from "crypto";
import type {
  Finding,
  FindingStatus,
  EvidenceRef,
  AuditLogEntry,
  Severity,
  AnalysisModule,
} from "@smartcar/shared";
import { findingDAO } from "../dao/finding.dao";
import { evidenceRefDAO } from "../dao/evidence-ref.dao";
import { auditLogDAO } from "../dao/audit-log.dao";
import { InvalidInputError, NotFoundError } from "../lib/errors";
import { createLogger } from "../lib/logger";

const logger = createLogger("finding-service");

// 상태 전이 규칙
const VALID_TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  open: ["needs_review"],
  sandbox: ["needs_review"],
  needs_review: ["accepted_risk", "false_positive", "fixed", "open"],
  accepted_risk: ["needs_review"],
  false_positive: ["needs_review"],
  fixed: ["needs_revalidation"],
  needs_revalidation: ["open", "fixed"],
};

export class FindingService {
  findById(id: string): (Finding & { evidenceRefs: EvidenceRef[]; auditLog: AuditLogEntry[] }) | undefined {
    const finding = findingDAO.findById(id);
    if (!finding) return undefined;

    const evidenceRefs = evidenceRefDAO.findByFindingId(id);
    const auditLog = auditLogDAO.findByResourceId(id);
    return { ...finding, evidenceRefs, auditLog };
  }

  findByProjectId(
    projectId: string,
    filters?: { status?: FindingStatus; severity?: Severity; module?: AnalysisModule }
  ): Finding[] {
    return findingDAO.findByProjectId(projectId, filters);
  }

  findByRunId(runId: string): Finding[] {
    return findingDAO.findByRunId(runId);
  }

  updateStatus(
    findingId: string,
    newStatus: FindingStatus,
    actor: string,
    reason: string,
    requestId?: string
  ): Finding {
    const finding = findingDAO.findById(findingId);
    if (!finding) throw new NotFoundError("Finding not found");

    const allowed = VALID_TRANSITIONS[finding.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new InvalidInputError(
        `Invalid status transition: ${finding.status} → ${newStatus}. Allowed: ${allowed?.join(", ") ?? "none"}`
      );
    }

    findingDAO.updateStatus(findingId, newStatus);

    // audit log 기록
    const logEntry: AuditLogEntry = {
      id: `audit-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      actor,
      action: "finding.status_change",
      resource: "finding",
      resourceId: findingId,
      detail: {
        from: finding.status,
        to: newStatus,
        reason,
      },
      requestId,
    };
    auditLogDAO.save(logEntry);

    logger.info({
      findingId,
      from: finding.status,
      to: newStatus,
      actor,
      requestId,
    }, "Finding status updated");

    return { ...finding, status: newStatus, updatedAt: new Date().toISOString() };
  }

  getSummary(projectId: string): { byStatus: Record<string, number>; bySeverity: Record<string, number>; total: number } {
    return findingDAO.summaryByProjectId(projectId);
  }
}
