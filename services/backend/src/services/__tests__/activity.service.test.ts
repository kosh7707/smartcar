import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActivityService } from "../activity.service";
import type { IRunDAO, IAuditLogDAO, IBuildTargetDAO } from "../../dao/interfaces";
import { makeRun, makeAuditLog, makeBuildTarget } from "../../test/factories";

function createMockRunDAO(): IRunDAO {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByProjectId: vi.fn().mockReturnValue([]),
    findByAnalysisResultId: vi.fn(),
    updateFindingCount: vi.fn(),
    trendByModule: vi.fn(),
    findLatestCompletedRuns: vi.fn().mockReturnValue([]),
  };
}

function createMockAuditLogDAO(): IAuditLogDAO {
  return {
    save: vi.fn(),
    findByResourceId: vi.fn(),
    findByResourceIds: vi.fn(),
    findFindingStatusChanges: vi.fn().mockReturnValue([]),
    findApprovalDecisions: vi.fn().mockReturnValue([]),
  };
}

function createMockBuildTargetDAO(): IBuildTargetDAO {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByProjectId: vi.fn().mockReturnValue([]),
    update: vi.fn(),
    updatePipelineState: vi.fn(),
    delete: vi.fn(),
    deleteByProjectId: vi.fn(),
  };
}

describe("ActivityService", () => {
  let service: ActivityService;
  let runDAO: IRunDAO;
  let auditLogDAO: IAuditLogDAO;
  let buildTargetDAO: IBuildTargetDAO;

  beforeEach(() => {
    runDAO = createMockRunDAO();
    auditLogDAO = createMockAuditLogDAO();
    buildTargetDAO = createMockBuildTargetDAO();
    service = new ActivityService(runDAO, auditLogDAO, buildTargetDAO);
  });

  it("returns empty array when no data exists", () => {
    const result = service.getTimeline("proj-1");
    expect(result).toEqual([]);
  });

  it("collects completed/failed runs", () => {
    vi.mocked(runDAO.findByProjectId).mockReturnValue([
      makeRun({ id: "r1", projectId: "p1", status: "completed", module: "static_analysis", findingCount: 5, endedAt: "2026-03-26T10:00:00Z" }),
      makeRun({ id: "r2", projectId: "p1", status: "failed", module: "deep_analysis", findingCount: 0, endedAt: "2026-03-26T09:00:00Z" }),
      makeRun({ id: "r3", projectId: "p1", status: "running", module: "static_analysis", findingCount: 0 }),
    ]);

    const result = service.getTimeline("p1");

    // running은 제외
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("run_completed");
    expect(result[0].metadata).toMatchObject({ runId: "r1", status: "completed" });
    expect(result[1].metadata).toMatchObject({ runId: "r2", status: "failed" });
  });

  it("collects finding status changes from audit log", () => {
    vi.mocked(auditLogDAO.findFindingStatusChanges).mockReturnValue([
      makeAuditLog({
        id: "al-1",
        timestamp: "2026-03-26T11:00:00Z",
        actor: "alice",
        action: "finding.status_change",
        resource: "finding",
        resourceId: "f-1",
        detail: { from: "open", to: "accepted_risk", reason: "ok" },
      }),
    ]);

    const result = service.getTimeline("p1");

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("finding_status_changed");
    expect(result[0].metadata).toMatchObject({ findingId: "f-1", actor: "alice", from: "open", to: "accepted_risk" });
  });

  it("collects approval decisions from audit log", () => {
    vi.mocked(auditLogDAO.findApprovalDecisions).mockReturnValue([
      makeAuditLog({
        id: "al-2",
        timestamp: "2026-03-26T12:00:00Z",
        actor: "admin",
        action: "approval.approved",
        resource: "approval",
        resourceId: "ap-1",
        detail: { decision: "approved", actionType: "gate.override" },
      }),
    ]);

    const result = service.getTimeline("p1");

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("approval_decided");
    expect(result[0].metadata).toMatchObject({ approvalId: "ap-1", decision: "approved" });
  });

  it("collects pipeline completions from build targets", () => {
    vi.mocked(buildTargetDAO.findByProjectId).mockReturnValue([
      makeBuildTarget({ id: "t1", projectId: "p1", name: "gateway", status: "ready", updatedAt: "2026-03-26T08:00:00Z" }),
      makeBuildTarget({ id: "t2", projectId: "p1", name: "ecu", status: "building" }),
    ]);

    const result = service.getTimeline("p1");

    // building은 제외
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("pipeline_completed");
    expect(result[0].metadata).toMatchObject({ targetId: "t1", targetName: "gateway" });
  });

  it("merges all sources and sorts by timestamp DESC", () => {
    vi.mocked(runDAO.findByProjectId).mockReturnValue([
      makeRun({ id: "r1", status: "completed", findingCount: 3, endedAt: "2026-03-26T09:00:00Z", createdAt: "2026-03-26T08:55:00Z" }),
    ]);
    vi.mocked(auditLogDAO.findFindingStatusChanges).mockReturnValue([
      makeAuditLog({ id: "al-1", timestamp: "2026-03-26T11:00:00Z", actor: "alice", resourceId: "f-1", detail: { from: "open", to: "fixed" } }),
    ]);
    vi.mocked(buildTargetDAO.findByProjectId).mockReturnValue([
      makeBuildTarget({ id: "t1", name: "gw", status: "ready", updatedAt: "2026-03-26T10:00:00Z" }),
    ]);

    const result = service.getTimeline("p1", 10);

    expect(result).toHaveLength(3);
    // 11:00 > 10:00 > 09:00
    expect(result[0].type).toBe("finding_status_changed");
    expect(result[1].type).toBe("pipeline_completed");
    expect(result[2].type).toBe("run_completed");
  });

  it("respects limit parameter on final output", () => {
    // 3개 소스 × 각 1개 = 3개 엔트리 → limit=2로 절삭
    vi.mocked(runDAO.findByProjectId).mockReturnValue([
      makeRun({ id: "r1", status: "completed", findingCount: 1, endedAt: "2026-03-26T09:00:00Z" }),
    ]);
    vi.mocked(auditLogDAO.findFindingStatusChanges).mockReturnValue([
      makeAuditLog({ id: "al-l", timestamp: "2026-03-26T11:00:00Z", actor: "x", resourceId: "f-1", detail: { from: "open", to: "fixed" } }),
    ]);
    vi.mocked(buildTargetDAO.findByProjectId).mockReturnValue([
      makeBuildTarget({ id: "t-l", name: "gw", status: "ready", updatedAt: "2026-03-26T10:00:00Z" }),
    ]);

    const result = service.getTimeline("p1", 2);

    // 3개 중 최신 2개만
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("finding_status_changed"); // 11:00
    expect(result[1].type).toBe("pipeline_completed");     // 10:00
  });
});
