import crypto from "crypto";
import type {
  Finding,
  FindingStatus,
  EvidenceRef,
  AuditLogEntry,
  Severity,
  AnalysisModule,
} from "@aegis/shared";
import type { IFindingDAO, IEvidenceRefDAO, IAuditLogDAO } from "../dao/interfaces";
import { InvalidInputError, NotFoundError } from "../lib/errors";
import { createLogger } from "../lib/logger";

const logger = createLogger("finding-service");

// 상태 전이 규칙
// 유연 워크플로우: 분석가가 직접 분류 가능. sandbox→sandbox 제외 (시스템 전용).
const VALID_TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  open: ["needs_review", "accepted_risk", "false_positive", "fixed"],
  sandbox: ["needs_review", "open", "false_positive"],
  needs_review: ["accepted_risk", "false_positive", "fixed", "open"],
  accepted_risk: ["needs_review", "open"],
  false_positive: ["needs_review", "open"],
  fixed: ["needs_revalidation", "open"],
  needs_revalidation: ["open", "fixed", "false_positive"],
};

export class FindingService {
  constructor(
    private findingDAO: IFindingDAO,
    private evidenceRefDAO: IEvidenceRefDAO,
    private auditLogDAO: IAuditLogDAO,
  ) {}

  findById(id: string): (Finding & { evidenceRefs: EvidenceRef[]; auditLog: AuditLogEntry[] }) | undefined {
    const finding = this.findingDAO.findById(id);
    if (!finding) return undefined;

    const evidenceRefs = this.evidenceRefDAO.findByFindingId(id);
    const auditLog = this.auditLogDAO.findByResourceId(id);
    return { ...finding, evidenceRefs, auditLog };
  }

  findByProjectId(
    projectId: string,
    filters?: {
      status?: FindingStatus | FindingStatus[];
      severity?: Severity | Severity[];
      module?: AnalysisModule;
      runId?: string;
      from?: string;
      to?: string;
    },
  ): Finding[] {
    return this.findingDAO.findByProjectId(projectId, filters);
  }

  findByRunId(runId: string): Finding[] {
    return this.findingDAO.findByRunId(runId);
  }

  updateStatus(
    findingId: string,
    newStatus: FindingStatus,
    actor: string,
    reason: string,
    requestId?: string
  ): Finding {
    const finding = this.findingDAO.findById(findingId);
    if (!finding) throw new NotFoundError("Finding not found");

    const allowed = VALID_TRANSITIONS[finding.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new InvalidInputError(
        `Invalid status transition: ${finding.status} → ${newStatus}. Allowed: ${allowed?.join(", ") ?? "none"}`
      );
    }

    this.findingDAO.updateStatus(findingId, newStatus);

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
    this.auditLogDAO.save(logEntry);

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
    return this.findingDAO.summaryByProjectId(projectId);
  }
}
