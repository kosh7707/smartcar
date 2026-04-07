/**
 * Playwright API route interception layer.
 * Mocks all backend API requests so tests run without a backend.
 *
 * IMPORTANT: Uses URL function matchers (not glob) to avoid intercepting
 * Vite dev server source files (e.g. /src/renderer/api/core.ts).
 * Only requests to the backend (localhost:3000) are intercepted.
 */
import { Page } from "@playwright/test";
import * as data from "../fixtures/mock-data";

const BACKEND_ORIGIN = "http://localhost:3000";

/** Check if a URL is a backend API request (not a Vite source file). */
function isBackendRequest(url: URL): boolean {
  return url.origin === BACKEND_ORIGIN;
}

export interface MockApi {
  /** Override a specific endpoint. pathPattern is matched with url.pathname.includes(). */
  on(method: string, pathPattern: string, body: unknown, status?: number): Promise<void>;
  /** Set up standard mocks for the projects list page. */
  setupProjectsList(): Promise<void>;
  /** Set up full project mocks (overview, files, findings, etc.) */
  setupProject(projectId?: string): Promise<void>;
  /** Set up auth-related mocks (login, me, users, logout). */
  setupAuth(): Promise<void>;
}

export async function createMockApi(page: Page): Promise<MockApi> {
  // Default: intercept all backend API calls with empty success
  await page.route(
    (url) => isBackendRequest(url) && url.pathname.startsWith("/api/"),
    (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    },
  );

  // Health check (backend only)
  await page.route(
    (url) => isBackendRequest(url) && url.pathname === "/health",
    (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data.HEALTH_OK),
      });
    },
  );

  // Block WebSocket attempts to backend
  await page.route(
    (url) => url.origin.replace(/^http/, "ws") === "ws://localhost:3000" && url.pathname.startsWith("/ws/"),
    (route) => route.abort(),
  );

  const api: MockApi = {
    async on(method, pathPattern, body, status = 200) {
      await page.route(
        (url) => isBackendRequest(url) && url.pathname.includes(pathPattern),
        (route, request) => {
          if (request.method() === method.toUpperCase()) {
            route.fulfill({
              status,
              contentType: "application/json",
              body: JSON.stringify(body),
            });
          } else {
            route.fallback();
          }
        },
      );
    },

    async setupProjectsList() {
      await api.on("GET", "/api/projects", { success: true, data: data.PROJECTS });
      await api.on("GET", "/api/analysis/status", data.ANALYSIS_STATUS_EMPTY);
    },

    async setupProject(projectId = "p-1") {
      await api.setupProjectsList();

      const pid = projectId;
      await api.on("GET", `/api/projects/${pid}/overview`, data.projectOverview(pid));
      // Pattern A: fetchSourceFilesWithComposition returns raw response (no .data extraction)
      await api.on("GET", `/api/projects/${pid}/source/files`, data.SOURCE_FILES_RESPONSE);
      await api.on("GET", `/api/projects/${pid}/files`, { success: true, data: data.FILES });
      await api.on("GET", `/api/projects/${pid}/targets`, { success: true, data: data.TARGETS });
      await api.on("GET", `/api/projects/${pid}/findings`, { success: true, data: data.FINDINGS });
      await api.on("GET", `/api/projects/${pid}/runs`, { success: true, data: data.RUNS });
      // fetchRunDetail uses /api/runs/:runId (no project prefix)
      await api.on("GET", "/api/runs/run-1", {
        success: true,
        data: { run: data.RUNS[0], gate: data.GATES[0], findings: data.FINDINGS.slice(0, 4).map((f) => ({ finding: f, evidenceRefs: [] })) },
      });
      await api.on("GET", "/api/runs/run-2", {
        success: true,
        data: { run: data.RUNS[1], findings: data.FINDINGS.slice(4).map((f) => ({ finding: f, evidenceRefs: [] })) },
      });
      await api.on("GET", `/api/projects/${pid}/gates`, { success: true, data: data.GATES });
      await api.on("GET", `/api/projects/${pid}/approvals`, { success: true, data: data.APPROVALS });
      await api.on("GET", `/api/projects/${pid}/approvals/count`, data.APPROVAL_COUNT);
      await api.on("GET", `/api/projects/${pid}/activity`, { success: true, data: data.ACTIVITIES });
      await api.on("GET", `/api/projects/${pid}/sdk`, { success: true, data: { builtIn: [], registered: [] } });
      await api.on("GET", `/api/projects/${pid}/settings`, { success: true, data: { llmUrl: "http://localhost:8080" } });
      await api.on("GET", `/api/projects/${pid}/report`, data.PROJECT_REPORT);
      await api.on("GET", `/api/projects/${pid}/pipeline/status`, {
        success: true, data: { targets: data.TARGETS, readyCount: 1, failedCount: 0, totalCount: 2 },
      });
      await api.on("GET", "/api/analysis/summary", data.DASHBOARD_SUMMARY);

      // Individual finding detail (fetchFindingDetail uses /api/findings/:id)
      // Enriched with evidence refs and audit log (MOCK-32)
      for (const f of data.FINDINGS) {
        const evidenceRefs = data.EVIDENCE_REFS.filter((e) => e.findingId === f.id);
        const auditLog = data.AUDIT_LOG_ENTRIES.filter((a) => a.resourceId === f.id);
        await api.on("GET", `/api/findings/${f.id}`, {
          success: true,
          data: { ...f, evidenceRefs, auditLog },
        });
      }

      // Build log
      await api.on("GET", `/api/projects/${pid}/targets/t-1/build-log`, {
        success: true, data: { buildLog: data.BUILD_LOG, status: "ready", updatedAt: "2026-03-25T09:56:05Z" },
      });
      await api.on("GET", `/api/projects/${pid}/targets/t-2/build-log`, {
        success: true, data: { buildLog: null, status: "building", updatedAt: "2026-03-27T09:00:00Z" },
      });

      // Gate profiles
      await api.on("GET", "/api/gate-profiles", { success: true, data: data.GATE_PROFILES });
      for (const gp of data.GATE_PROFILES) {
        await api.on("GET", `/api/gate-profiles/${gp.id}`, { success: true, data: gp });
      }

      // Finding groups
      await api.on("GET", `/api/projects/${pid}/findings/groups`, { success: true, data: data.FINDING_GROUPS });

      // Custom report
      await api.on("POST", `/api/projects/${pid}/report/custom`, { success: true, data: data.CUSTOM_REPORT_RESPONSE });

      // Notifications
      await api.on("GET", `/api/projects/${pid}/notifications`, { success: true, data: data.NOTIFICATIONS });
      await api.on("GET", `/api/projects/${pid}/notifications/count`, data.NOTIFICATION_COUNT);
      await api.on("PATCH", "/api/notifications/", { success: true });
      await api.on("PATCH", `/api/projects/${pid}/notifications/read-all`, { success: true });

      // File content (MOCK-33)
      await api.on("GET", `/api/projects/${pid}/source/content`, data.FILE_CONTENT_RESPONSE);
      await api.on("GET", `/api/projects/${pid}/source/file`, data.FILE_CONTENT_RESPONSE);

      // Settings with gate profile
      await api.on("PUT", `/api/projects/${pid}/settings`, { success: true, data: { llmUrl: "http://localhost:8080", gateProfileId: "gp-default" } });

      // Auth (also set up auth routes when setting up project)
      await api.setupAuth();
    },

    async setupAuth() {
      await api.on("POST", "/api/auth/login", data.LOGIN_RESPONSE);
      await api.on("GET", "/api/auth/me", data.AUTH_ME_RESPONSE);
      await api.on("POST", "/api/auth/logout", { success: true });
      await api.on("GET", "/api/auth/users", { success: true, data: [data.AUTH_USER] });
    },
  };

  return api;
}
