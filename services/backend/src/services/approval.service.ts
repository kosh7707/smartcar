import crypto from "crypto";
import type { ApprovalRequest, ApprovalActionType, ApprovalStatus, AuditLogEntry } from "@aegis/shared";
import type { IApprovalDAO, IAuditLogDAO } from "../dao/interfaces";
import { createLogger } from "../lib/logger";
import { NotFoundError, InvalidInputError } from "../lib/errors";
import type { QualityGateService } from "./quality-gate.service";

const logger = createLogger("approval");

const EXPIRY_HOURS = 24;

export class ApprovalService {
  constructor(
    private approvalDAO: IApprovalDAO,
    private auditLogDAO: IAuditLogDAO,
    private gateService: QualityGateService,
    private notificationService?: import("./notification.service").NotificationService,
  ) {}

  /** 승인 요청 생성 */
  createRequest(
    actionType: ApprovalActionType,
    targetId: string,
    projectId: string,
    reason: string,
    actor?: string
  ): ApprovalRequest {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);

    const request: ApprovalRequest = {
      id: `approval-${crypto.randomUUID()}`,
      actionType,
      requestedBy: actor ?? "analyst",
      targetId,
      projectId,
      reason,
      status: "pending",
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    };

    this.approvalDAO.save(request);
    logger.info({ approvalId: request.id, actionType, targetId }, "Approval requested");

    if (this.notificationService) {
      try {
        this.notificationService.emit({
          projectId,
          type: "approval_pending",
          title: `승인 요청: ${actionType} — ${reason.slice(0, 50)}`,
          jobKind: "approval",
          resourceId: request.id,
        });
      } catch { /* 알림 실패는 승인 요청에 영향 없음 */ }
    }

    return request;
  }

  /** 승인/거절 결정 */
  decide(
    approvalId: string,
    decision: "approved" | "rejected",
    actor: string,
    comment?: string,
    requestId?: string
  ): ApprovalRequest {
    const request = this.approvalDAO.findById(approvalId);
    if (!request) throw new NotFoundError(`Approval not found: ${approvalId}`);

    // lazy expiration 체크
    if (request.status === "pending" && new Date(request.expiresAt) < new Date()) {
      this.approvalDAO.updateStatus(approvalId, "expired");
      throw new InvalidInputError("Approval request has expired");
    }

    if (request.status !== "pending") {
      throw new InvalidInputError(`Approval is already ${request.status}`);
    }

    const decisionRecord: ApprovalRequest["decision"] = {
      decidedBy: actor,
      decidedAt: new Date().toISOString(),
      comment,
    };

    this.approvalDAO.updateStatus(approvalId, decision, decisionRecord);

    // 감사 로그
    const logEntry: AuditLogEntry = {
      id: `audit-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      actor,
      action: `approval.${decision}`,
      resource: "approval",
      resourceId: approvalId,
      detail: {
        actionType: request.actionType,
        targetId: request.targetId,
        decision,
        comment: comment ?? null,
      },
      requestId,
    };
    this.auditLogDAO.save(logEntry);

    logger.info({ approvalId, decision, actor, actionType: request.actionType }, "Approval decided");

    // 후처리: gate override 승인 시 gate 상태 변경
    if (decision === "approved" && request.actionType === "gate.override") {
      this.gateService.applyOverride(request.targetId, actor, request.reason, approvalId);
    }

    return { ...request, status: decision, decision: decisionRecord };
  }

  getById(id: string): ApprovalRequest | undefined {
    const request = this.approvalDAO.findById(id);
    if (request) return this.applyLazyExpiration(request);
    return undefined;
  }

  getPending(projectId?: string): ApprovalRequest[] {
    const requests = projectId
      ? this.approvalDAO.findByProjectId(projectId, "pending")
      : this.approvalDAO.findPending();
    return requests.map((r) => this.applyLazyExpiration(r)).filter((r) => r.status === "pending");
  }

  getCountByProjectId(projectId: string): { pending: number; total: number } {
    const all = this.getByProjectId(projectId);
    const pending = all.filter((r) => r.status === "pending").length;
    return { pending, total: all.length };
  }

  getByProjectId(projectId: string): ApprovalRequest[] {
    return this.approvalDAO.findByProjectId(projectId).map((r) => this.applyLazyExpiration(r));
  }

  /** 만료된 pending 요청을 expired로 전환 (lazy) */
  private applyLazyExpiration(request: ApprovalRequest): ApprovalRequest {
    if (request.status === "pending" && new Date(request.expiresAt) < new Date()) {
      this.approvalDAO.updateStatus(request.id, "expired");
      return { ...request, status: "expired" };
    }
    return request;
  }
}
