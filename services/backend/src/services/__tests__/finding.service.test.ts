import { describe, it, expect, vi, beforeEach } from "vitest";
import { FindingService } from "../finding.service";
import type { IFindingDAO, IEvidenceRefDAO, IAuditLogDAO } from "../../dao/interfaces";
import { makeFinding, makeEvidenceRef, makeAuditLog } from "../../test/factories";
import { NotFoundError, InvalidInputError } from "../../lib/errors";

function createMockFindingDAO(): IFindingDAO {
  return {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findByRunId: vi.fn(),
    findByProjectId: vi.fn(),
    findByIds: vi.fn().mockReturnValue([]),
    findByFingerprint: vi.fn(),
    findAllByFingerprint: vi.fn().mockReturnValue([]),
    updateStatus: vi.fn(),
    withTransaction: vi.fn((fn: () => any) => fn()),
    summaryByProjectId: vi.fn(),
    summaryByModule: vi.fn(),
    topFilesByModule: vi.fn(),
    topRulesByModule: vi.fn(),
  };
}

function createMockEvidenceRefDAO(): IEvidenceRefDAO {
  return {
    save: vi.fn(),
    saveMany: vi.fn(),
    findByFindingId: vi.fn().mockReturnValue([]),
    findByFindingIds: vi.fn().mockReturnValue(new Map()),
  };
}

function createMockAuditLogDAO(): IAuditLogDAO {
  return {
    save: vi.fn(),
    findByResourceId: vi.fn().mockReturnValue([]),
    findByResourceIds: vi.fn().mockReturnValue([]),
    findFindingStatusChanges: vi.fn().mockReturnValue([]),
    findApprovalDecisions: vi.fn().mockReturnValue([]),
  };
}

describe("FindingService", () => {
  let service: FindingService;
  let findingDAO: IFindingDAO;
  let evidenceRefDAO: IEvidenceRefDAO;
  let auditLogDAO: IAuditLogDAO;

  beforeEach(() => {
    findingDAO = createMockFindingDAO();
    evidenceRefDAO = createMockEvidenceRefDAO();
    auditLogDAO = createMockAuditLogDAO();
    service = new FindingService(findingDAO, evidenceRefDAO, auditLogDAO);
  });

  describe("findById", () => {
    it("returns finding with evidenceRefs and auditLog", () => {
      const finding = makeFinding({ id: "f-1" });
      const refs = [makeEvidenceRef({ findingId: "f-1" })];
      const logs = [makeAuditLog({ resourceId: "f-1" })];

      vi.mocked(findingDAO.findById).mockReturnValue(finding);
      vi.mocked(evidenceRefDAO.findByFindingId).mockReturnValue(refs);
      vi.mocked(auditLogDAO.findByResourceId).mockReturnValue(logs);

      const result = service.findById("f-1");
      expect(result).toBeDefined();
      expect(result!.id).toBe("f-1");
      expect(result!.evidenceRefs).toHaveLength(1);
      expect(result!.auditLog).toHaveLength(1);
    });

    it("returns undefined when not found", () => {
      vi.mocked(findingDAO.findById).mockReturnValue(undefined);
      expect(service.findById("nonexistent")).toBeUndefined();
    });
  });

  describe("updateStatus — valid transitions", () => {
    const validTransitions: Array<{ from: string; to: string }> = [
      { from: "open", to: "needs_review" },
      { from: "open", to: "accepted_risk" },
      { from: "open", to: "false_positive" },
      { from: "open", to: "fixed" },
      { from: "sandbox", to: "needs_review" },
      { from: "sandbox", to: "open" },
      { from: "sandbox", to: "false_positive" },
      { from: "needs_review", to: "accepted_risk" },
      { from: "needs_review", to: "false_positive" },
      { from: "needs_review", to: "fixed" },
      { from: "needs_review", to: "open" },
      { from: "accepted_risk", to: "needs_review" },
      { from: "accepted_risk", to: "open" },
      { from: "false_positive", to: "needs_review" },
      { from: "false_positive", to: "open" },
      { from: "fixed", to: "needs_revalidation" },
      { from: "fixed", to: "open" },
      { from: "needs_revalidation", to: "open" },
      { from: "needs_revalidation", to: "fixed" },
      { from: "needs_revalidation", to: "false_positive" },
    ];

    it.each(validTransitions)("allows $from → $to", ({ from, to }) => {
      const finding = makeFinding({ id: "f-1", status: from as any });
      vi.mocked(findingDAO.findById).mockReturnValue(finding);

      const result = service.updateStatus("f-1", to as any, "analyst", "test reason");
      expect(result.status).toBe(to);
      expect(findingDAO.updateStatus).toHaveBeenCalledWith("f-1", to);
      expect(auditLogDAO.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateStatus — invalid transitions", () => {
    const invalidTransitions: Array<{ from: string; to: string }> = [
      { from: "open", to: "sandbox" },
      { from: "open", to: "needs_revalidation" },
      { from: "sandbox", to: "fixed" },
      { from: "sandbox", to: "accepted_risk" },
      { from: "sandbox", to: "sandbox" },
      { from: "needs_review", to: "sandbox" },
      { from: "fixed", to: "false_positive" },
      { from: "fixed", to: "accepted_risk" },
    ];

    it.each(invalidTransitions)("rejects $from → $to", ({ from, to }) => {
      const finding = makeFinding({ id: "f-1", status: from as any });
      vi.mocked(findingDAO.findById).mockReturnValue(finding);

      expect(() =>
        service.updateStatus("f-1", to as any, "analyst", "test reason")
      ).toThrow(InvalidInputError);
      expect(findingDAO.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("updateStatus — edge cases", () => {
    it("throws NotFoundError when finding does not exist", () => {
      vi.mocked(findingDAO.findById).mockReturnValue(undefined);

      expect(() =>
        service.updateStatus("no-such", "fixed" as any, "analyst", "reason")
      ).toThrow(NotFoundError);
    });

    it("records audit log with correct fields", () => {
      const finding = makeFinding({ id: "f-1", status: "open" });
      vi.mocked(findingDAO.findById).mockReturnValue(finding);

      service.updateStatus("f-1", "fixed", "alice", "issue resolved", "req-123");

      const savedEntry = vi.mocked(auditLogDAO.save).mock.calls[0][0];
      expect(savedEntry.actor).toBe("alice");
      expect(savedEntry.action).toBe("finding.status_change");
      expect(savedEntry.resource).toBe("finding");
      expect(savedEntry.resourceId).toBe("f-1");
      expect(savedEntry.detail).toEqual({
        from: "open",
        to: "fixed",
        reason: "issue resolved",
      });
      expect(savedEntry.requestId).toBe("req-123");
    });
  });

  describe("bulkUpdateStatus", () => {
    it("updates multiple findings in a transaction", () => {
      const f1 = makeFinding({ id: "f-1", projectId: "p1", status: "open" });
      const f2 = makeFinding({ id: "f-2", projectId: "p1", status: "open" });
      vi.mocked(findingDAO.findByIds).mockReturnValue([f1, f2]);

      const result = service.bulkUpdateStatus(["f-1", "f-2"], "needs_review", "alice", "batch review");

      expect(result).toEqual({ updated: 2, failed: 0 });
      expect(findingDAO.withTransaction).toHaveBeenCalledTimes(1);
      expect(findingDAO.updateStatus).toHaveBeenCalledTimes(2);
      expect(auditLogDAO.save).toHaveBeenCalledTimes(2);

      const audit1 = vi.mocked(auditLogDAO.save).mock.calls[0][0];
      expect(audit1.action).toBe("finding.status_change");
      expect(audit1.detail).toMatchObject({ from: "open", to: "needs_review", bulk: true });
    });

    it("counts not-found findings as failed", () => {
      const f1 = makeFinding({ id: "f-1", projectId: "p1", status: "open" });
      vi.mocked(findingDAO.findByIds).mockReturnValue([f1]);

      const result = service.bulkUpdateStatus(["f-1", "f-missing"], "needs_review", "alice", "batch");

      expect(result).toEqual({ updated: 1, failed: 1 });
    });

    it("counts invalid transitions as failed", () => {
      const f1 = makeFinding({ id: "f-1", projectId: "p1", status: "open" });
      vi.mocked(findingDAO.findByIds).mockReturnValue([f1]);

      const result = service.bulkUpdateStatus(["f-1"], "sandbox", "alice", "bad transition");

      expect(result).toEqual({ updated: 0, failed: 1 });
      expect(findingDAO.updateStatus).not.toHaveBeenCalled();
    });

    it("handles mixed valid and invalid transitions", () => {
      const f1 = makeFinding({ id: "f-1", projectId: "p1", status: "open" });
      const f2 = makeFinding({ id: "f-2", projectId: "p1", status: "sandbox" });
      vi.mocked(findingDAO.findByIds).mockReturnValue([f1, f2]);

      // open → accepted_risk is valid, sandbox → accepted_risk is NOT valid
      const result = service.bulkUpdateStatus(["f-1", "f-2"], "accepted_risk", "alice", "accept all");

      expect(result).toEqual({ updated: 1, failed: 1 });
      expect(findingDAO.updateStatus).toHaveBeenCalledTimes(1);
      expect(findingDAO.updateStatus).toHaveBeenCalledWith("f-1", "accepted_risk");
    });

    it("passes requestId to audit log", () => {
      const f1 = makeFinding({ id: "f-1", projectId: "p1", status: "open" });
      vi.mocked(findingDAO.findByIds).mockReturnValue([f1]);

      service.bulkUpdateStatus(["f-1"], "fixed", "alice", "done", "req-bulk-1");

      const audit = vi.mocked(auditLogDAO.save).mock.calls[0][0];
      expect(audit.requestId).toBe("req-bulk-1");
    });
  });

  describe("getHistory", () => {
    it("returns undefined for nonexistent finding", () => {
      vi.mocked(findingDAO.findById).mockReturnValue(undefined);
      expect(service.getHistory("no-such")).toBeUndefined();
    });

    it("returns empty array when finding has no fingerprint", () => {
      const finding = makeFinding({ id: "f-1", fingerprint: undefined });
      vi.mocked(findingDAO.findById).mockReturnValue(finding);

      expect(service.getHistory("f-1")).toEqual([]);
    });

    it("returns siblings with same fingerprint", () => {
      const finding = makeFinding({ id: "f-1", projectId: "p1", fingerprint: "fp-abc" });
      const sibling1 = makeFinding({ id: "f-old-1", runId: "run-1", projectId: "p1", fingerprint: "fp-abc", status: "fixed", createdAt: "2026-03-20T00:00:00Z" });
      const sibling2 = makeFinding({ id: "f-1", runId: "run-2", projectId: "p1", fingerprint: "fp-abc", status: "open", createdAt: "2026-03-25T00:00:00Z" });

      vi.mocked(findingDAO.findById).mockReturnValue(finding);
      vi.mocked(findingDAO.findAllByFingerprint).mockReturnValue([sibling2, sibling1]);

      const history = service.getHistory("f-1");
      expect(history).toHaveLength(2);
      expect(history![0]).toMatchObject({ findingId: "f-1", status: "open" });
      expect(history![1]).toMatchObject({ findingId: "f-old-1", status: "fixed" });
    });
  });

  describe("getSummary", () => {
    it("delegates to findingDAO.summaryByProjectId", () => {
      const summary = { byStatus: { open: 3 }, bySeverity: { high: 2 }, total: 3 };
      vi.mocked(findingDAO.summaryByProjectId).mockReturnValue(summary);

      expect(service.getSummary("proj-1")).toEqual(summary);
      expect(findingDAO.summaryByProjectId).toHaveBeenCalledWith("proj-1");
    });
  });

  describe("findByProjectId", () => {
    it("passes filters to DAO", () => {
      const findings = [makeFinding()];
      vi.mocked(findingDAO.findByProjectId).mockReturnValue(findings);

      const filters = { status: "open" as any, severity: "high" as any };
      const result = service.findByProjectId("proj-1", filters);

      expect(result).toEqual(findings);
      expect(findingDAO.findByProjectId).toHaveBeenCalledWith("proj-1", filters);
    });
  });
});
