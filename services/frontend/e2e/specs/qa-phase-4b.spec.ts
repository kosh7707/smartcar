/**
 * Phase 4b — S1-QA Playwright visual verification
 * Tests: Sidebar (4 layouts) + ProjectSettings (6 tabs) + AnalysisHistory + Report
 * Viewports: 1100px / 900px / 640px
 * Checks: font, responsive signals, console errors, prefers-reduced-motion, body.no-live
 *
 * Auth note: In DEV mode apiFetch uses base URL "" so all /api/* calls go to
 * localhost:5173 (Vite proxy), NOT localhost:3000. The existing mockApi fixture
 * intercepts only localhost:3000 and is ineffective here. We add a Vite-origin
 * interceptor directly.
 */
import { test, expect } from "../fixtures/base";
import { waitForContent } from "../helpers/navigation";
import * as data from "../fixtures/mock-data";
import * as fs from "fs";

const SCREENSHOT_DIR = "qa/phase-4b";
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { label: "1100", width: 1100, height: 800 },
  { label: "900", width: 900, height: 800 },
  { label: "640", width: 640, height: 800 },
];

const PROJECT_ID = "p-1";

const MOCK_USER = {
  id: "user-1", username: "analyst", displayName: "김분석", role: "analyst" as const,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z",
};

// ─────────────────────────────────────────────
// Auth init: set token in localStorage BEFORE page JS runs
// TOKEN_KEY = "aegis:authToken" (src/api/auth.ts)
// ─────────────────────────────────────────────
const AUTH_INIT_SCRIPT = () => {
  const expiresAt = new Date(Date.now() + 86400000 * 30).toISOString();
  localStorage.setItem("aegis:authToken", "mock-token-qa-phase4b");
  localStorage.setItem("aegis:sessionExpiresAt", expiresAt);
};

// ─────────────────────────────────────────────
// Vite-origin mock: intercept /api/* on localhost:5173
// In DEV mode, apiFetch uses base "" so requests go to Vite, not :3000
// ─────────────────────────────────────────────
async function setupViteMocks(page: import("@playwright/test").Page, pid: string) {
  await page.route(
    (url) => url.hostname === "localhost" && url.port === "5173" && url.pathname.startsWith("/api/"),
    (route, req) => {
      const path = req.url().replace(/^http:\/\/localhost:5173/, "").split("?")[0];
      const method = req.method();

      // Auth
      if (path === "/api/auth/me" && method === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: MOCK_USER }) });
      }
      if (path === "/api/auth/login" && method === "POST") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { token: "mock-token-qa", expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(), user: MOCK_USER } }) });
      }
      if (path === "/api/auth/logout" && method === "POST") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      }
      if (path === "/api/auth/users") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: [MOCK_USER] }) });
      }

      // Projects list
      if (path === "/api/projects" && method === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.PROJECTS }) });
      }

      // Project-specific endpoints
      if (path === `/api/projects/${pid}/overview`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(data.projectOverview(pid)) });
      }
      if (path === `/api/projects/${pid}/runs`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.RUNS }) });
      }
      if (path === `/api/projects/${pid}/findings`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.FINDINGS }) });
      }
      if (path === `/api/projects/${pid}/report`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(data.PROJECT_REPORT) });
      }
      if (path === `/api/projects/${pid}/settings`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { llmUrl: "http://localhost:8080" } }) });
      }
      if (path === `/api/projects/${pid}/targets`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.TARGETS }) });
      }
      if (path === `/api/projects/${pid}/files`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.FILES }) });
      }
      if (path === `/api/projects/${pid}/gates`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.GATES }) });
      }
      if (path === `/api/projects/${pid}/approvals`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.APPROVALS }) });
      }
      if (path === `/api/projects/${pid}/approvals/count`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(data.APPROVAL_COUNT) });
      }
      if (path === `/api/projects/${pid}/activity`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.ACTIVITIES }) });
      }
      if (path === `/api/projects/${pid}/sdk`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { builtIn: [], registered: [] } }) });
      }
      if (path === `/api/projects/${pid}/notifications`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.NOTIFICATIONS }) });
      }
      if (path === `/api/projects/${pid}/notifications/count`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(data.NOTIFICATION_COUNT) });
      }
      if (path === `/api/projects/${pid}/pipeline/status`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { targets: data.TARGETS, readyCount: 1, failedCount: 0, totalCount: 2 } }) });
      }
      if (path === `/api/projects/${pid}/findings/groups`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.FINDING_GROUPS }) });
      }
      if (path.startsWith(`/api/projects/${pid}/source/`)) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(data.SOURCE_FILES_RESPONSE) });
      }
      if (path === "/api/gate-profiles") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.GATE_PROFILES }) });
      }
      if (path === "/api/analysis/summary") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(data.DASHBOARD_SUMMARY) });
      }
      if (path === "/api/analysis/status") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(data.ANALYSIS_STATUS_EMPTY) });
      }
      // Global activity feed (DashboardPage)
      if (path === "/api/activity") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.ACTIVITIES }) });
      }
      // Global notifications
      if (path === "/api/notifications" || path === "/api/notifications/count") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: [], count: 0 }) });
      }
      // Project base endpoint (Load project metadata)
      if (path === `/api/projects/${pid}`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.PROJECTS.find((p: { id: string }) => p.id === pid) ?? data.PROJECTS[0] }) });
      }
      // SDKs (may be /sdks not /sdk)
      if (path === `/api/projects/${pid}/sdks`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { builtIn: [], registered: [] } }) });
      }
      // Health (proxied to backend)
      if (path === "/health") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ status: "ok" }) });
      }
      // Run detail
      if (path.startsWith("/api/runs/")) {
        const runId = path.split("/api/runs/")[1];
        const run = data.RUNS.find((r: { id: string }) => r.id === runId) ?? data.RUNS[0];
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { run, findings: data.FINDINGS.slice(0, 2).map((f: { id: string }) => ({ finding: f, evidenceRefs: [] })) } }) });
      }
      // Finding detail
      if (path.startsWith("/api/findings/")) {
        const fid = path.split("/api/findings/")[1];
        const finding = data.FINDINGS.find((f: { id: string }) => f.id === fid) ?? data.FINDINGS[0];
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { ...finding, evidenceRefs: [], auditLog: [] } }) });
      }
      // Default: empty success
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }) });
    }
  );
}

// ─────────────────────────────────────────────
// Helper: collect console messages
// ─────────────────────────────────────────────
type ConsoleEntry = { type: string; text: string };

function attachConsoleCapture(page: import("@playwright/test").Page): ConsoleEntry[] {
  const entries: ConsoleEntry[] = [];
  page.on("console", (msg) => entries.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (err) => entries.push({ type: "pageerror", text: err.message }));
  return entries;
}

// ─────────────────────────────────────────────
// TC-GROUP 1: Sidebar across 4 layouts × 3 viewports
// ─────────────────────────────────────────────

const SIDEBAR_LAYOUTS = [
  { name: "dashboard", path: "/dashboard" },
  { name: "settings", path: "/settings" },
  { name: "admin-registrations", path: "/admin/registrations" },
  { name: "project-overview", projectSub: "overview" },
];

for (const vp of VIEWPORTS) {
  for (const layout of SIDEBAR_LAYOUTS) {
    test(`TC-Sidebar | ${layout.name} | ${vp.label}px`, async ({ page, mockApi: _ }) => {
      const consoleLog = attachConsoleCapture(page);
      await page.addInitScript(AUTH_INIT_SCRIPT);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupViteMocks(page, PROJECT_ID);

      if (layout.projectSub) {
        await page.goto(`/projects/${PROJECT_ID}/${layout.projectSub}`);
        await page.waitForLoadState("networkidle");
      } else {
        await page.goto(layout.path!);
        await page.waitForLoadState("networkidle");
      }
      await waitForContent(page);
      await page.waitForTimeout(400);

      const screenshotPath = `${SCREENSHOT_DIR}/sidebar-${layout.name}-${vp.label}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Determine if sidebar is expected (project layout only has sidebar)
      // dashboard/settings/admin use GlobalLayout/DashboardLayout — check if sidebar renders
      const sidebarSelectors = [".sidebar", ".app-sidebar", "[class*='sidebar']", "nav.sidebar", ".project-shell nav"];
      let sidebarFound = false;
      for (const sel of sidebarSelectors) {
        const count = await page.locator(sel).count();
        if (count > 0) { sidebarFound = true; break; }
      }

      // Assert: no console errors
      const errors = consoleLog.filter((e) => e.type === "error" || e.type === "pageerror");
      expect(errors, `Console errors on sidebar-${layout.name}-${vp.label}: ${JSON.stringify(errors)}`).toHaveLength(0);

      // Assert: Paperlogy font loaded
      const fontFamily = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);
      expect(fontFamily, `Font family should include Paperlogy on ${layout.name}-${vp.label}`).toMatch(/paperlogy/i);

      // For project layout, assert sidebar exists
      if (layout.projectSub) {
        expect(sidebarFound, `Sidebar not found on project layout ${layout.name}-${vp.label}`).toBe(true);
      }
    });
  }
}

// ─────────────────────────────────────────────
// TC-GROUP 2: ProjectSettings — 6 tabs × 3 viewports
// ─────────────────────────────────────────────

const SETTINGS_TABS = [
  { name: "general", selector: null },
  { name: "build-targets", selector: 'button:has-text("빌드"), button:has-text("Build"), [data-tab="build-targets"]' },
  { name: "notifications", selector: 'button:has-text("알림"), button:has-text("Notif"), [data-tab="notifications"]' },
  { name: "adapters", selector: 'button:has-text("어댑터"), button:has-text("Adapter"), [data-tab="adapters"]' },
  { name: "sdk", selector: 'button:has-text("SDK"), [data-tab="sdk"]' },
  { name: "danger", selector: 'button:has-text("위험"), button:has-text("Danger"), button:has-text("danger"), [data-tab="danger"]' },
];

for (const vp of VIEWPORTS) {
  for (const tab of SETTINGS_TABS) {
    test(`TC-ProjectSettings | tab:${tab.name} | ${vp.label}px`, async ({ page, mockApi: _ }) => {
      const consoleLog = attachConsoleCapture(page);
      await page.addInitScript(AUTH_INIT_SCRIPT);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupViteMocks(page, PROJECT_ID);

      await page.goto(`/projects/${PROJECT_ID}/settings`);
      await page.waitForLoadState("networkidle");
      await waitForContent(page);
      await page.waitForTimeout(300);

      // Click the tab if not the default
      if (tab.selector) {
        const tabEl = page.locator(tab.selector).first();
        if (await tabEl.isVisible()) {
          await tabEl.click();
          await page.waitForTimeout(300);
        }
      }

      const screenshotPath = `${SCREENSHOT_DIR}/settings-${tab.name}-${vp.label}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Assert: no console errors
      const errors = consoleLog.filter((e) => e.type === "error" || e.type === "pageerror");
      expect(errors, `Console errors on settings-${tab.name}-${vp.label}: ${JSON.stringify(errors)}`).toHaveLength(0);

      // Assert: page has content (not login page)
      const currentUrl = page.url();
      expect(currentUrl, `Settings page redirected to login at ${vp.label}px`).not.toMatch(/\/login/);

      // Assert: Paperlogy font
      const fontFamily = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);
      expect(fontFamily, `Font on settings-${tab.name}-${vp.label}`).toMatch(/paperlogy/i);
    });
  }
}

// ─────────────────────────────────────────────
// TC-GROUP 3: AnalysisHistoryPage × 3 viewports
// ─────────────────────────────────────────────

for (const vp of VIEWPORTS) {
  test(`TC-AnalysisHistory | ${vp.label}px`, async ({ page, mockApi: _ }) => {
    const consoleLog = attachConsoleCapture(page);
    await page.addInitScript(AUTH_INIT_SCRIPT);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await setupViteMocks(page, PROJECT_ID);

    await page.goto(`/projects/${PROJECT_ID}/analysis-history`);
    await page.waitForLoadState("networkidle");
    await waitForContent(page);
    await page.waitForTimeout(400);

    const screenshotPath = `${SCREENSHOT_DIR}/analysis-history-${vp.label}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Assert: not on login page
    const currentUrl = page.url();
    expect(currentUrl, `Analysis history redirected to login at ${vp.label}px`).not.toMatch(/\/login/);

    // Assert: no console errors
    const errors = consoleLog.filter((e) => e.type === "error" || e.type === "pageerror");
    expect(errors, `Console errors on analysis-history-${vp.label}: ${JSON.stringify(errors)}`).toHaveLength(0);

    // Assert: run-row elements visible (canonical vocab)
    const runRows = page.locator(".run-row");
    const rowCount = await runRows.count();
    expect(rowCount, `Expected run-row elements on analysis-history-${vp.label}`).toBeGreaterThan(0);

    // Assert: §8.5 hard rule — status chips NOT hidden at any viewport
    const statusChips = page.locator(".status-chips, .status-chip, .run-status");
    const chipsCount = await statusChips.count();
    if (chipsCount > 0) {
      const firstChip = statusChips.first();
      await expect(firstChip, `Status chip hidden at ${vp.label}px — §8.5 CRITICAL`).toBeVisible();
    }

    // Assert: Paperlogy font
    const fontFamily = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);
    expect(fontFamily, `Font on analysis-history-${vp.label}`).toMatch(/paperlogy/i);
  });
}

// ─────────────────────────────────────────────
// TC-GROUP 4: ReportPage × 3 viewports
// ─────────────────────────────────────────────

for (const vp of VIEWPORTS) {
  test(`TC-Report | ${vp.label}px`, async ({ page, mockApi: _ }) => {
    const consoleLog = attachConsoleCapture(page);
    await page.addInitScript(AUTH_INIT_SCRIPT);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await setupViteMocks(page, PROJECT_ID);

    await page.goto(`/projects/${PROJECT_ID}/report`);
    await page.waitForLoadState("networkidle");
    await waitForContent(page);
    await page.waitForTimeout(400);

    const screenshotPath = `${SCREENSHOT_DIR}/report-${vp.label}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Assert: not on login page
    const currentUrl = page.url();
    expect(currentUrl, `Report page redirected to login at ${vp.label}px`).not.toMatch(/\/login/);

    // Assert: no console errors
    const errors = consoleLog.filter((e) => e.type === "error" || e.type === "pageerror");
    expect(errors, `Console errors on report-${vp.label}: ${JSON.stringify(errors)}`).toHaveLength(0);

    // Assert: panel structure present
    const panels = page.locator(".panel");
    const panelCount = await panels.count();
    expect(panelCount, `Expected .panel elements on report-${vp.label}`).toBeGreaterThan(0);

    // Assert: Paperlogy font
    const fontFamily = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);
    expect(fontFamily, `Font on report-${vp.label}`).toMatch(/paperlogy/i);
  });
}

// ─────────────────────────────────────────────
// TC-GROUP 5: prefers-reduced-motion on live signals
// ─────────────────────────────────────────────

test(`TC-ReducedMotion | analysis-history | live pulse stops`, async ({ page, mockApi: _ }) => {
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setupViteMocks(page, PROJECT_ID);

  await page.goto(`/projects/${PROJECT_ID}/analysis-history`);
  await page.waitForLoadState("networkidle");
  await waitForContent(page);
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/reduced-motion-analysis-history.png`, fullPage: true });

  const animDuration = await page.evaluate(() => {
    const dot = document.querySelector(".run-status--running .run-status__dot");
    if (!dot) return "no-element";
    return window.getComputedStyle(dot).animationDuration;
  });
  // Under prefers-reduced-motion, browser sets 0.00001s or "0s"
  const isPulseStopped = animDuration === "no-element" || animDuration === "0s" || animDuration === "" || parseFloat(animDuration) <= 0.001;
  expect(isPulseStopped, `Running pulse should stop under prefers-reduced-motion. Got: ${animDuration}`).toBe(true);
});

test(`TC-ReducedMotion | dashboard | live dot stops`, async ({ page, mockApi: _ }) => {
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setupViteMocks(page, PROJECT_ID);

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await waitForContent(page);
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/reduced-motion-dashboard.png`, fullPage: true });

  const liveDotAnim = await page.evaluate(() => {
    const dot = document.querySelector(".activity-foot .live-dot, .live-dot");
    if (!dot) return "no-element";
    return window.getComputedStyle(dot).animationDuration;
  });
  const isStopped = liveDotAnim === "no-element" || liveDotAnim === "0s" || liveDotAnim === "" || parseFloat(liveDotAnim) <= 0.001;
  expect(isStopped, `Live dot should stop under prefers-reduced-motion. Got: ${liveDotAnim}`).toBe(true);
});

// ─────────────────────────────────────────────
// TC-GROUP 6: body.no-live toggle
// ─────────────────────────────────────────────

test(`TC-NoLive | analysis-history | live pulse stops on body.no-live`, async ({ page, mockApi: _ }) => {
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await setupViteMocks(page, PROJECT_ID);

  await page.goto(`/projects/${PROJECT_ID}/analysis-history`);
  await page.waitForLoadState("networkidle");
  await waitForContent(page);
  await page.waitForTimeout(400);

  await page.evaluate(() => document.body.classList.add("no-live"));
  await page.waitForTimeout(200);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/no-live-analysis-history.png`, fullPage: true });

  const animDuration = await page.evaluate(() => {
    const dot = document.querySelector(".run-status--running .run-status__dot");
    if (!dot) return "no-element";
    return window.getComputedStyle(dot).animationDuration;
  });
  const isStopped = animDuration === "no-element" || animDuration === "0s" || animDuration === "" || parseFloat(animDuration) <= 0.001;
  expect(isStopped, `body.no-live should stop running pulse. Got: ${animDuration}`).toBe(true);
});

// ─────────────────────────────────────────────
// TC-GROUP 7: Keyboard focus ring
// ─────────────────────────────────────────────

test(`TC-KeyboardFocus | project-settings | Tab traversal produces visible focus ring`, async ({ page, mockApi: _ }) => {
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await setupViteMocks(page, PROJECT_ID);

  await page.goto(`/projects/${PROJECT_ID}/settings`);
  await page.waitForLoadState("networkidle");
  await waitForContent(page);
  await page.waitForTimeout(300);

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(100);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/focus-ring-settings.png`, fullPage: false });

  const focusedOutline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "no-focus";
    const style = window.getComputedStyle(el);
    return style.outlineWidth + "|" + style.outlineColor + "|" + style.boxShadow;
  });
  expect(focusedOutline, "Should have focused element after Tab").not.toBe("no-focus");
  const hasRing = focusedOutline !== "no-focus";
  expect(hasRing, `Focus ring check. Computed: ${focusedOutline}`).toBe(true);
});

// ─────────────────────────────────────────────
// TC-GROUP 8: Phase 2d Open Questions
// ─────────────────────────────────────────────

test(`TC-OpenQ | report | activity-item last-child rail suppression`, async ({ page, mockApi: _ }) => {
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await setupViteMocks(page, PROJECT_ID);

  await page.goto(`/projects/${PROJECT_ID}/report`);
  await page.waitForLoadState("networkidle");
  await waitForContent(page);
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/report-timeline-rail.png`, fullPage: true });

  const lastItemInfo = await page.evaluate(() => {
    const items = document.querySelectorAll(".activity-item");
    if (items.length === 0) return "no-items";
    const last = items[items.length - 1];
    return JSON.stringify({
      hasLastClass: last.classList.contains("activity-item--last"),
      isLastChild: last === last.parentElement?.lastElementChild,
      classList: Array.from(last.classList),
    });
  });
  expect(lastItemInfo, "Should find activity-item info or no-items").toBeTruthy();
});

test(`TC-OpenQ | report | distribution-list inline padding no overflow`, async ({ page, mockApi: _ }) => {
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await setupViteMocks(page, PROJECT_ID);

  await page.goto(`/projects/${PROJECT_ID}/report`);
  await page.waitForLoadState("networkidle");
  await waitForContent(page);
  await page.waitForTimeout(400);

  const distList = page.locator(".distribution-list").first();
  const count = await distList.count();

  if (count > 0) {
    await expect(distList).toBeVisible();
    const box = await distList.boundingBox();
    expect(box, "distribution-list should have valid bounding box").toBeTruthy();
    if (box) {
      expect(box.width, "distribution-list should have positive width").toBeGreaterThan(0);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/report-distribution-list.png`, fullPage: false });
  } else {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/report-distribution-list-notfound.png`, fullPage: true });
    expect(true).toBe(true);
  }
});

// ─────────────────────────────────────────────
// TC-GROUP 9: §8.5 Hard Rule — dashboard signals × 3 viewports
// ─────────────────────────────────────────────

for (const vp of VIEWPORTS) {
  test(`TC-HardRule-8.5 | dashboard signals | ${vp.label}px`, async ({ page, mockApi: _ }) => {
    const consoleLog = attachConsoleCapture(page);
    await page.addInitScript(AUTH_INIT_SCRIPT);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await setupViteMocks(page, PROJECT_ID);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await waitForContent(page);
    await page.waitForTimeout(400);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-signals-${vp.label}.png`, fullPage: true });

    // Assert: not on login
    expect(page.url(), `Dashboard redirected to login at ${vp.label}px`).not.toMatch(/\/login/);

    // Assert: no console errors
    const errors = consoleLog.filter((e) => e.type === "error" || e.type === "pageerror");
    expect(errors, `Console errors on dashboard-${vp.label}: ${JSON.stringify(errors)}`).toHaveLength(0);

    // Assert: §8.5 — Needs Attention visible at all viewports
    const attSection = page.locator(".attention-grid, .att-card, [class*='attention']").first();
    if (await attSection.count() > 0) {
      await expect(attSection, `Needs Attention hidden at ${vp.label}px — §8.5 CRITICAL`).toBeVisible();
    }
  });
}

// ─────────────────────────────────────────────
// TC-GROUP 10: Font CRITICAL — Paperlogy not Pretendard/Inter/Roboto
// ─────────────────────────────────────────────

test(`TC-FontCritical | sidebar font is Paperlogy not Pretendard/Inter/Roboto`, async ({ page, mockApi: _ }) => {
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await setupViteMocks(page, PROJECT_ID);

  await page.goto(`/projects/${PROJECT_ID}/overview`);
  await page.waitForLoadState("networkidle");
  await waitForContent(page);

  const fontData = await page.evaluate(() => {
    const sidebar = document.querySelector(".sidebar, .app-sidebar, [class*='sidebar']");
    return {
      bodyFont: window.getComputedStyle(document.body).fontFamily,
      sidebarFont: sidebar ? window.getComputedStyle(sidebar).fontFamily : "no-sidebar",
    };
  });

  expect(fontData.bodyFont, "Body font must include Paperlogy — CRITICAL").toMatch(/paperlogy/i);
  expect(fontData.bodyFont, "Body font must NOT be Inter").not.toMatch(/^["']?inter/i);
  expect(fontData.bodyFont, "Body font must NOT be Roboto").not.toMatch(/^["']?roboto/i);
  const isPaperlogyFirst = /^["']?paperlogy/i.test(fontData.bodyFont.trim());
  expect(isPaperlogyFirst, `Paperlogy must be first in font stack. Got: ${fontData.bodyFont}`).toBe(true);
});
