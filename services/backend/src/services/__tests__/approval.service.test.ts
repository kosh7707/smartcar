import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApprovalService } from "../approval.service";
import type { IApprovalDAO, IAuditLogDAO } from "../../dao/interfaces";
import type { QualityGateService } from "../quality-gate.service";
import { makeApproval } from "../../test/factories";
import { NotFoundError, InvalidInputError } from "../../lib/errors";

function createMockApprovalDAO(): IApprovalDAO {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByTargetId: vi.fn().mockReturnValue([]),
    findByProjectId: vi.fn().mockReturnValue([]),
    findPending: vi.fn().mockReturnValue([]),
    updateStatus: vi.fn(),
  };
}

function createMockAuditLogDAO(): IAuditLogDAO {
  return {
    save: vi.fn(),
    findByResourceId: vi.fn().mockReturnValue([]),
    findByResourceIds: vi.fn().mockReturnValue([]),
  };
}

function createMockGateService(): QualityGateService {
  return {
    evaluateRun: vi.fn(),
    applyOverride: vi.fn(),
    getById: vi.fn(),
    getByRunId: vi.fn(),
    getByProjectId: vi.fn(),
  } as any;
}

describe("ApprovalService", () => {
  let service: ApprovalService;
  let approvalDAO: IApprovalDAO;
  let auditLogDAO: IAuditLogDAO;
  let gateService: QualityGateService;

  beforeEach(() => {
    approvalDAO = createMockApprovalDAO();
    auditLogDAO = createMockAuditLogDAO();
    gateService = createMockGateService();
    service = new ApprovalService(approvalDAO, auditLogDAO, gateService);
  });

  describe("createRequest", () => {
    it("creates an approval request with 24h expiry", () => {
      const result = service.createRequest("gate.override", "gate-1", "proj-1", "need override");

      expect(approvalDAO.save).toHaveBeenCalledTimes(1);
      const saved = vi.mocked(approvalDAO.save).mock.calls[0][0];
      expect(saved.actionType).toBe("gate.override");
      expect(saved.targetId).toBe("gate-1");
      expect(saved.projectId).toBe("proj-1");
      expect(saved.status).toBe("pending");
      expect(saved.requestedBy).toBe("analyst"); // default actor

      // expiry should be ~24h in the future
      const expiry = new Date(saved.expiresAt).getTime();
      const created = new Date(saved.createdAt).getTime();
      const diffHours = (expiry - created) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 0);
    });

    it("uses provided actor name", () => {
      service.createRequest("gate.override", "gate-1", "proj-1", "reason", "alice");

      const saved = vi.mocked(approvalDAO.save).mock.calls[0][0];
      expect(saved.requestedBy).toBe("alice");
    });
  });

  describe("decide", () => {
    it("approves a pending request", () => {
      const request = makeApproval({
        id: "ap-1",
        status: "pending",
        actionType: "finding.accepted_risk",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      vi.mocked(approvalDAO.findById).mockReturnValue(request);

      const result = service.decide("ap-1", "approved", "admin", "looks good");
      expect(result.status).toBe("approved");
      expect(result.decision).toBeDefined();
      expect(result.decision!.decidedBy).toBe("admin");
      expect(result.decision!.comment).toBe("looks good");
      expect(approvalDAO.updateStatus).toHaveBeenCalledWith("ap-1", "approved", expect.any(Object));
      expect(auditLogDAO.save).toHaveBeenCalledTimes(1);
    });

    it("rejects a pending request", () => {
      const request = makeApproval({
        id: "ap-1",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      vi.mocked(approvalDAO.findById).mockReturnValue(request);

      const result = service.decide("ap-1", "rejected", "admin", "not justified");
      expect(result.status).toBe("rejected");
    });

    it("throws NotFoundError for nonexistent approval", () => {
      vi.mocked(approvalDAO.findById).mockReturnValue(undefined);
      expect(() => service.decide("no-such", "approved", "admin")).toThrow(NotFoundError);
    });

    it("throws InvalidInputError for already decided approval", () => {
      const request = makeApproval({ id: "ap-1", status: "approved" });
      vi.mocked(approvalDAO.findById).mockReturnValue(request);

      expect(() => service.decide("ap-1", "approved", "admin")).toThrow(InvalidInputError);
    });

    it("expires and throws for expired pending approval", () => {
      const request = makeApproval({
        id: "ap-1",
        status: "pending",
        expiresAt: new Date(Date.now() - 1000).toISOString(), // already expired
      });
      vi.mocked(approvalDAO.findById).mockReturnValue(request);

      expect(() => service.decide("ap-1", "approved", "admin")).toThrow(InvalidInputError);
      expect(approvalDAO.updateStatus).toHaveBeenCalledWith("ap-1", "expired");
    });

    it("triggers gate override when gate.override approval is approved", () => {
      const request = makeApproval({
        id: "ap-1",
        status: "pending",
        actionType: "gate.override",
        targetId: "gate-1",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      vi.mocked(approvalDAO.findById).mockReturnValue(request);

      service.decide("ap-1", "approved", "admin", "override needed");

      expect(gateService.applyOverride).toHaveBeenCalledWith(
        "gate-1", "admin", request.reason, "ap-1"
      );
    });

    it("does NOT trigger gate override on rejection", () => {
      const request = makeApproval({
        id: "ap-1",
        status: "pending",
        actionType: "gate.override",
        targetId: "gate-1",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      vi.mocked(approvalDAO.findById).mockReturnValue(request);

      service.decide("ap-1", "rejected", "admin");
      expect(gateService.applyOverride).not.toHaveBeenCalled();
    });

    it("does NOT trigger gate override for non-gate action types", () => {
      const request = makeApproval({
        id: "ap-1",
        status: "pending",
        actionType: "finding.accepted_risk",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      vi.mocked(approvalDAO.findById).mockReturnValue(request);

      service.decide("ap-1", "approved", "admin");
      expect(gateService.applyOverride).not.toHaveBeenCalled();
    });
  });

  describe("getPending", () => {
    it("filters out lazily-expired requests", () => {
      const expired = makeApproval({
        status: "pending",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      const valid = makeApproval({
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      vi.mocked(approvalDAO.findPending).mockReturnValue([expired, valid]);

      const result = service.getPending();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(valid.id);
      expect(approvalDAO.updateStatus).toHaveBeenCalledWith(expired.id, "expired");
    });
  });
});
