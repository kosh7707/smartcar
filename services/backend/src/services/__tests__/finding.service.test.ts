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
    findByFingerprint: vi.fn(),
    updateStatus: vi.fn(),
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
