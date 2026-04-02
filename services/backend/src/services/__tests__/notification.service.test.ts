import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "../notification.service";
import type { INotificationDAO } from "../../dao/interfaces";
import { makeNotification } from "../../test/factories";

function createMockNotificationDAO(): INotificationDAO {
  return {
    save: vi.fn(),
    findByProjectId: vi.fn().mockReturnValue([]),
    unreadCount: vi.fn().mockReturnValue(0),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  };
}

function createMockWs() {
  return { broadcast: vi.fn() } as any;
}

describe("NotificationService", () => {
  let service: NotificationService;
  let dao: INotificationDAO;

  beforeEach(() => {
    dao = createMockNotificationDAO();
    service = new NotificationService(dao);
  });

  describe("emit", () => {
    it("saves notification and returns it", () => {
      const result = service.emit({
        projectId: "proj-1",
        type: "analysis_complete",
        title: "Analysis done",
        body: "Completed successfully",
      });
      expect(result.id).toMatch(/^notif-/);
      expect(result.projectId).toBe("proj-1");
      expect(result.type).toBe("analysis_complete");
      expect(result.title).toBe("Analysis done");
      expect(result.read).toBe(false);
      expect(dao.save).toHaveBeenCalledOnce();
    });

    it("sets body to empty string when omitted", () => {
      const result = service.emit({
        projectId: "proj-1",
        type: "gate_failed",
        title: "Gate failed",
      });
      expect(result.body).toBe("");
    });

    it("broadcasts via WS when broadcaster is provided", () => {
      const ws = createMockWs();
      const wsService = new NotificationService(dao, ws);
      const result = wsService.emit({
        projectId: "proj-1",
        type: "critical_finding",
        title: "Critical found",
        severity: "critical",
      });
      expect(ws.broadcast).toHaveBeenCalledWith("proj-1", {
        type: "notification",
        payload: result,
      });
    });

    it("does not fail when WS is undefined", () => {
      expect(() =>
        service.emit({ projectId: "proj-1", type: "analysis_complete", title: "Test" }),
      ).not.toThrow();
    });
  });

  describe("findByProjectId", () => {
    it("delegates to DAO", () => {
      const notifications = [makeNotification()];
      (dao.findByProjectId as ReturnType<typeof vi.fn>).mockReturnValue(notifications);
      const result = service.findByProjectId("proj-1");
      expect(result).toEqual(notifications);
      expect(dao.findByProjectId).toHaveBeenCalledWith("proj-1", undefined);
    });

    it("passes unreadOnly filter", () => {
      service.findByProjectId("proj-1", true);
      expect(dao.findByProjectId).toHaveBeenCalledWith("proj-1", true);
    });
  });

  describe("unreadCount", () => {
    it("delegates to DAO", () => {
      (dao.unreadCount as ReturnType<typeof vi.fn>).mockReturnValue(5);
      expect(service.unreadCount("proj-1")).toBe(5);
      expect(dao.unreadCount).toHaveBeenCalledWith("proj-1");
    });
  });

  describe("markAsRead", () => {
    it("delegates to DAO", () => {
      service.markAsRead("notif-1");
      expect(dao.markAsRead).toHaveBeenCalledWith("notif-1");
    });
  });

  describe("markAllAsRead", () => {
    it("delegates to DAO", () => {
      service.markAllAsRead("proj-1");
      expect(dao.markAllAsRead).toHaveBeenCalledWith("proj-1");
    });
  });
});
