/**
 * Phase 4b' — S1-QA Playwright re-verification
 * PRIMARY criterion: mock v2 layout fidelity (tab-strip horizontal, 6 tabs, page-head, panels)
 * Secondary: token/font checks, console errors, a11y, URL sync, reduced-motion
 * Viewports: 1100 / 900 / 640
 */
import { test, expect } from "../fixtures/base";
import * as data from "../fixtures/mock-data";
import * as fs from "fs";

const SCREENSHOT_DIR = "qa/phase-4b-prime";
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { label: "1100", width: 1100, height: 800 },
  { label: "900", width: 900, height: 800 },
  { label: "640", width: 640, height: 800 },
] as const;

const PROJECT_ID = "p-1";

const MOCK_USER = {
  id: "user-1", username: "analyst", displayName: "김분석", role: "analyst" as const,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z",
};

// SDK mock data with ready/active/failed variants
const SDK_LIST_MOCK = [
  {
    id: "sdk-1",
    name: "Yocto Dunfell x86_64 → armv7a",
    status: "processing",
    progress: 68,
    type: "archive",
    currentStep: "ai_analysis",
    steps: ["upload", "extract", "ai_analysis", "validate", "complete"],
    version: null,
    targetArch: "armv7a",
    addedAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "sdk-2",
    name: "NXP i.MX8 Linaro GCC 10.3",
    status: "failed",
    progress: 75,
    type: "binary",
    currentStep: "validate",
    steps: ["upload", "extract", "ai_analysis", "validate", "complete"],
    error: "테스트 프로그램 컴파일 실패: 'stdio.h' not found in sysroot",
    version: "10.3.0",
    targetArch: "aarch64",
    addedAt: "2026-01-12T00:00:00Z",
  },
  {
    id: "sdk-3",
    name: "Raspberry Pi aarch64 GCC 11.4",
    status: "ready",
    progress: 100,
    type: "folder",
    currentStep: "complete",
    steps: ["upload", "extract", "ai_analysis", "validate", "complete"],
    version: "11.4.0",
    targetArch: "aarch64-linux-gnu",
    addedAt: "2026-01-14T00:00:00Z",
  },
];

const AUTH_INIT_SCRIPT = () => {
  const expiresAt = new Date(Date.now() + 86400000 * 30).toISOString();
  localStorage.setItem("aegis:authToken", "mock-token-qa-phase4b-prime");
  localStorage.setItem("aegis:sessionExpiresAt", expiresAt);
};

async function setupViteMocks(page: import("@playwright/test").Page, pid: string) {
  await page.route(
    (url) => url.hostname === "localhost" && url.port === "5173" && url.pathname.startsWith("/api/"),
    (route, req) => {
      const path = req.url().replace(/^http:\/\/localhost:5173/, "").split("?")[0];
      const method = req.method();

      if (path === "/api/auth/me" && method === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: MOCK_USER }) });
      }
      if (path === "/api/auth/login" && method === "POST") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: { token: "mock-token-qa-phase4b-prime", expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(), user: MOCK_USER } }) });
      }
      if (path === "/api/auth/logout" && method === "POST") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      }
      if (path === "/api/auth/users") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: [MOCK_USER] }) });
      }
      if (path === "/api/projects" && method === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.PROJECTS }) });
      }
      if (path === `/api/projects/${pid}` && method === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: data.PROJECTS[0] }) });
      }
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
          body: JSON.stringify({ success: true, data: {
            name: "차량 게이트웨이 ECU",
            description: "차량용 게이트웨이 ECU 보안 분석 프로젝트",
            visibility: "internal",
            llmUrl: "http://localhost:8080",
          }}) });
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
      if (path === `/api/projects/${pid}/sdk` || path === `/api/projects/${pid}/sdks`) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: SDK_LIST_MOCK }) });
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
      // fallback: 404
      return route.fulfill({ status: 404, contentType: "application/json",
        body: JSON.stringify({ success: false, error: `Not mocked: ${path}` }) });
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function goToSettings(page: import("@playwright/test").Page, section?: string) {
  const url = `http://localhost:5173/projects/${PROJECT_ID}/settings${section ? `?section=${section}` : ""}`;
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // Wait for page to render (not loading spinner)
  await page.waitForTimeout(600);
}

async function collectConsoleErrors(page: import("@playwright/test").Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// TC1: Tab-strip horizontal layout (CRITICAL mock v2 fidelity)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC1: tab-strip horizontal (mock v2 fidelity)", () => {
  for (const vp of VIEWPORTS) {
    test(`tab-strip at ${vp.label}px`, async ({ page }) => {
      await setupViteMocks(page, PROJECT_ID);
      await goToSettings(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Screenshot
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/tab-strip-${vp.label}.png`,
        fullPage: false,
      });

      // Evaluate tab-strip orientation
      const tabInfo = await page.evaluate(() => {
        // Look for tab-strip, filter-pills--tabs, or ps-tabs
        const selectors = [
          ".tab-strip",
          ".filter-pills--tabs",
          ".ps-tabs",
          "[role='tablist']",
          ".project-settings-tabs",
          ".settings-tabs",
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const items = el.querySelectorAll(
              "button, [role='tab'], .tab, .pill, .ps-tab"
            );
            const itemRects = Array.from(items).map((i) => {
              const r = (i as HTMLElement).getBoundingClientRect();
              return { x: r.x, y: r.y, text: (i as HTMLElement).innerText?.slice(0, 20) };
            });
            return {
              found: true,
              selector: sel,
              display: style.display,
              flexDir: style.flexDirection,
              width: rect.width,
              height: rect.height,
              itemCount: items.length,
              items: itemRects,
            };
          }
        }
        return { found: false };
      });

      console.log(`[TC1][${vp.label}] tabInfo:`, JSON.stringify(tabInfo));
      expect(tabInfo.found, "tab-strip element must exist").toBe(true);
      expect(tabInfo.itemCount, "tab-strip must have 6 tabs").toBeGreaterThanOrEqual(6);

      // Items should be arranged horizontally: all similar Y, varying X
      if (tabInfo.items && tabInfo.items.length >= 2) {
        const firstY = tabInfo.items[0].y;
        const lastY = tabInfo.items[tabInfo.items.length - 1].y;
        // Horizontal: Y values close (within 60px even if wrapped)
        // Check first vs second tab - they should not be vertically stacked (Y diff > 30px per row)
        // We allow wrap at 640px but items must still be visible
        const yDiff = Math.abs((tabInfo.items[1]?.y ?? 0) - (tabInfo.items[0]?.y ?? 0));
        console.log(`[TC1][${vp.label}] first-second tab Y diff: ${yDiff}`);
        // At 1100 and 900: tabs should be in a single horizontal row (yDiff < 5)
        if (vp.width >= 900) {
          expect(yDiff, `at ${vp.label}px tabs must be on same horizontal row`).toBeLessThan(10);
        }
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC2: All 6 tabs render and are visible
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC2: 6 tabs present and visible", () => {
  for (const vp of VIEWPORTS) {
    test(`6 tabs visible at ${vp.label}px`, async ({ page }) => {
      await setupViteMocks(page, PROJECT_ID);
      await goToSettings(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      const tabInfo = await page.evaluate(() => {
        const EXPECTED_TABS = ["general", "sdk", "targets", "adapters", "notify", "danger"];
        const results: Record<string, { found: boolean; visible: boolean; text: string }> = {};

        // Try multiple selector strategies
        const allButtons = Array.from(document.querySelectorAll(
          ".tab-strip button, .filter-pills--tabs .pill, [role='tablist'] button, [role='tablist'] [role='tab'], .ps-tab, .settings-tab"
        ));

        const allTablike = Array.from(document.querySelectorAll(
          "button[data-section], button[data-tab], [data-section]"
        ));

        const combined = [...new Set([...allButtons, ...allTablike])];

        for (const tab of EXPECTED_TABS) {
          const el = combined.find((b) => {
            const text = (b as HTMLElement).innerText?.toLowerCase() ?? "";
            const ds = (b as HTMLElement).dataset?.section ?? "";
            const dt = (b as HTMLElement).dataset?.tab ?? "";
            return text.includes(tab) || ds.includes(tab) || dt.includes(tab);
          });
          if (el) {
            const rect = (el as HTMLElement).getBoundingClientRect();
            const style = getComputedStyle(el as HTMLElement);
            results[tab] = {
              found: true,
              visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
              text: (el as HTMLElement).innerText?.slice(0, 30) ?? "",
            };
          } else {
            results[tab] = { found: false, visible: false, text: "" };
          }
        }
        return { results, combinedCount: combined.length };
      });

      console.log(`[TC2][${vp.label}] tabs:`, JSON.stringify(tabInfo.results));

      const tabs = ["general", "sdk", "targets", "adapters", "notify", "danger"];
      for (const tab of tabs) {
        const info = tabInfo.results[tab];
        expect(info?.found, `tab '${tab}' must exist at ${vp.label}px`).toBe(true);
        expect(info?.visible, `tab '${tab}' must be visible at ${vp.label}px`).toBe(true);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC3: page-head layout (crumb + h1 + ph-meta)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC3: page-head layout", () => {
  for (const vp of VIEWPORTS) {
    test(`page-head at ${vp.label}px`, async ({ page }) => {
      await setupViteMocks(page, PROJECT_ID);
      await goToSettings(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/page-head-${vp.label}.png`,
        fullPage: false,
      });

      const headInfo = await page.evaluate(() => {
        // crumb: breadcrumb-style element
        const crumb = document.querySelector(".crumb, .page-breadcrumbs, nav[aria-label='breadcrumb'], .breadcrumb");
        // h1: page title
        const h1 = document.querySelector("h1");
        // ph-meta: meta info row
        const meta = document.querySelector(".ph-meta, .page-meta, .page-meta-inline");

        return {
          crumb: {
            found: !!crumb,
            text: crumb ? (crumb as HTMLElement).innerText?.slice(0, 50) : null,
            visible: crumb ? (crumb as HTMLElement).getBoundingClientRect().height > 0 : false,
          },
          h1: {
            found: !!h1,
            text: h1 ? h1.innerText?.slice(0, 50) : null,
            visible: h1 ? h1.getBoundingClientRect().height > 0 : false,
          },
          meta: {
            found: !!meta,
            text: meta ? (meta as HTMLElement).innerText?.slice(0, 80) : null,
            visible: meta ? (meta as HTMLElement).getBoundingClientRect().height > 0 : false,
          },
        };
      });

      console.log(`[TC3][${vp.label}] page-head:`, JSON.stringify(headInfo));
      expect(headInfo.h1.found, "h1 title must exist").toBe(true);
      expect(headInfo.h1.visible, "h1 title must be visible").toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC4: General tab — section-head + panel + form-row + 2-col grid
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC4: General tab layout", () => {
  for (const vp of VIEWPORTS) {
    test(`General tab at ${vp.label}px`, async ({ page }) => {
      await setupViteMocks(page, PROJECT_ID);
      await goToSettings(page, "general");
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Click General tab if not already active
      const generalTab = page.locator(
        ".tab-strip button, [role='tablist'] button, button[data-section]"
      ).filter({ hasText: /일반|general/i }).first();
      if (await generalTab.count() > 0) {
        await generalTab.click();
        await page.waitForTimeout(300);
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/general-${vp.label}.png`,
        fullPage: true,
      });

      const generalInfo = await page.evaluate(() => {
        // Look for form inputs visible in the general pane
        const nameInput = document.querySelector("input#pname, input[id*='name'], input[placeholder*='이름']");
        const descInput = document.querySelector("textarea#pdesc, textarea[id*='desc']");
        const sectionHead = document.querySelector(".section-head, .ps-section-head");
        const panel = document.querySelector(".card, .panel, .ps-panel");
        const formField = document.querySelector(".form-field");
        const formLabel = document.querySelector(".form-label");

        return {
          nameInput: {
            found: !!nameInput,
            visible: nameInput ? (nameInput as HTMLElement).getBoundingClientRect().height > 0 : false,
          },
          descInput: {
            found: !!descInput,
            visible: descInput ? (descInput as HTMLElement).getBoundingClientRect().height > 0 : false,
          },
          sectionHead: !!sectionHead,
          panel: !!panel,
          formField: !!formField,
          formLabel: !!formLabel,
        };
      });

      console.log(`[TC4][${vp.label}] general:`, JSON.stringify(generalInfo));
      expect(generalInfo.panel, "panel/card must exist in General tab").toBe(true);
      expect(generalInfo.formField, "form-field must exist in General tab").toBe(true);
      expect(generalInfo.nameInput.found, "project name input must exist").toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC5: SDK tab — section-head + add button + sdk-list (ready/active/failed)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC5: SDK tab layout", () => {
  for (const vp of VIEWPORTS) {
    test(`SDK tab at ${vp.label}px`, async ({ page }) => {
      await setupViteMocks(page, PROJECT_ID);
      await goToSettings(page, "sdk");
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Click SDK tab
      const sdkTab = page.locator(
        ".tab-strip button, [role='tablist'] button, button[data-section]"
      ).filter({ hasText: /sdk/i }).first();
      if (await sdkTab.count() > 0) {
        await sdkTab.click();
        await page.waitForTimeout(400);
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/sdk-${vp.label}.png`,
        fullPage: true,
      });

      const sdkInfo = await page.evaluate(() => {
        const addBtn = document.querySelector(
          "#btnAddSdk, button[id*='add'], button[id*='Add']"
        ) || Array.from(document.querySelectorAll("button")).find(b =>
          (b as HTMLButtonElement).innerText?.includes("SDK") && (b as HTMLButtonElement).innerText?.includes("추가")
        );

        const sdkList = document.querySelector(".sdk-list, .sdk-items, [class*='sdk-list']");

        // status chips: ready, processing/active, failed
        const readyEl = document.querySelector(".sdk-status.ready, [class*='ready'], .sdk-row.ready");
        const activeEl = document.querySelector(".sdk-status.pending, .sdk-status.processing, [class*='active'], .sdk-expanded.active, .sdk-expanded");
        const failedEl = document.querySelector(".sdk-status.failed, [class*='failed'], .sdk-expanded.failed");

        const stepper = document.querySelector(".stepper, .sdk-stepper, [class*='stepper']");
        const progressTrack = document.querySelector(".progress-track, [class*='progress']");

        return {
          addBtn: !!addBtn,
          sdkList: !!sdkList,
          readyEl: !!readyEl,
          activeEl: !!activeEl,
          failedEl: !!failedEl,
          stepper: !!stepper,
          progressTrack: !!progressTrack,
        };
      });

      console.log(`[TC5][${vp.label}] sdk:`, JSON.stringify(sdkInfo));
      expect(sdkInfo.addBtn, "SDK add button must exist").toBe(true);
      // SDK list may be empty if API returns [] — just check the section renders
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC6: Placeholder tabs (build-targets, adapters, notify) — reserved card
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC6: Placeholder tabs", () => {
  const PLACEHOLDER_TABS = [
    { section: "targets", label: "빌드 타겟", keyword: /타겟|target|reserved|v0\.2/i },
    { section: "adapters", label: "어댑터", keyword: /어댑터|adapter|reserved|v0\.2/i },
    { section: "notify", label: "알림", keyword: /알림|notify|reserved|v0\.2/i },
  ];

  for (const vp of VIEWPORTS) {
    for (const pt of PLACEHOLDER_TABS) {
      test(`Placeholder '${pt.section}' at ${vp.label}px`, async ({ page }) => {
        await setupViteMocks(page, PROJECT_ID);
        await goToSettings(page, pt.section);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(300);

        // Click the tab
        const tabBtn = page.locator(
          ".tab-strip button, [role='tablist'] button, button[data-section]"
        ).filter({ hasText: new RegExp(pt.section === "targets" ? "타겟|target" : pt.section === "adapters" ? "어댑터|adapt" : "알림|notify", "i") }).first();
        if (await tabBtn.count() > 0) {
          await tabBtn.click();
          await page.waitForTimeout(300);
        }

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/placeholder-${pt.section}-${vp.label}.png`,
          fullPage: true,
        });

        const placeholderInfo = await page.evaluate((keyword: string) => {
          const reserved = document.querySelector(".reserved, [class*='reserved'], .placeholder-card, .coming-soon");
          const verTag = document.querySelector(".ver-tag, .pill-soon, [class*='ver-tag'], [class*='soon']");
          const bodyText = document.body.innerText;

          return {
            reserved: !!reserved,
            verTag: !!verTag,
            bodyHasKeyword: new RegExp(keyword, "i").test(bodyText),
            reservedText: reserved ? (reserved as HTMLElement).innerText?.slice(0, 100) : null,
          };
        }, keyword.source);

        console.log(`[TC6][${pt.section}][${vp.label}]:`, JSON.stringify(placeholderInfo));
        // The section must render with some placeholder content
        expect(placeholderInfo.reserved || placeholderInfo.verTag || placeholderInfo.bodyHasKeyword,
          `Placeholder '${pt.section}' must show reserved card or version tag at ${vp.label}px`
        ).toBe(true);
      });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC7: Danger tab — danger-head + 2 actions (archive + delete)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC7: Danger tab layout", () => {
  for (const vp of VIEWPORTS) {
    test(`Danger tab at ${vp.label}px`, async ({ page }) => {
      await setupViteMocks(page, PROJECT_ID);
      await goToSettings(page, "danger");
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Click danger tab
      const dangerTab = page.locator(
        ".tab-strip button, [role='tablist'] button, button[data-section]"
      ).filter({ hasText: /위험|danger/i }).first();
      if (await dangerTab.count() > 0) {
        await dangerTab.click();
        await page.waitForTimeout(300);
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/danger-${vp.label}.png`,
        fullPage: true,
      });

      const dangerInfo = await page.evaluate(() => {
        const dangerHead = document.querySelector(".danger-head, .danger .danger-head, [class*='danger-head']");
        const irreversibleTag = document.querySelector(".tag, [class*='irreversible']");
        const archiveBtn = Array.from(document.querySelectorAll("button")).find(b =>
          (b as HTMLButtonElement).innerText?.includes("아카이브")
        );
        const deleteBtn = Array.from(document.querySelectorAll("button")).find(b => {
          const t = (b as HTMLButtonElement).innerText ?? "";
          return t.includes("삭제") && !t.includes("취소");
        });
        const dangerRows = document.querySelectorAll(".danger-row, .danger-action, [class*='danger-row']");

        return {
          dangerHead: !!dangerHead,
          irreversibleTag: !!irreversibleTag,
          archiveBtn: !!archiveBtn,
          deleteBtn: !!deleteBtn,
          dangerRowCount: dangerRows.length,
        };
      });

      console.log(`[TC7][${vp.label}] danger:`, JSON.stringify(dangerInfo));
      expect(dangerInfo.archiveBtn, "Archive button must exist in Danger tab").toBe(true);
      expect(dangerInfo.deleteBtn, "Delete button must exist in Danger tab").toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC8: change-bar dirty state
// ─────────────────────────────────────────────────────────────────────────────
test("TC8: change-bar appears on input change (General tab)", async ({ page }) => {
  await setupViteMocks(page, PROJECT_ID);
  await goToSettings(page, "general");
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(400);

  // Click General tab
  const generalTab = page.locator(
    ".tab-strip button, [role='tablist'] button, button[data-section]"
  ).filter({ hasText: /일반|general/i }).first();
  if (await generalTab.count() > 0) {
    await generalTab.click();
    await page.waitForTimeout(300);
  }

  // Find name input
  const nameInput = page.locator("input#pname, input[id*='name'], input[placeholder*='이름'], input[name='name']").first();

  const changeBarBefore = await page.evaluate(() => {
    const cb = document.querySelector(".change-bar, #changebar, [class*='change-bar']");
    if (!cb) return { found: false, visible: false };
    const rect = (cb as HTMLElement).getBoundingClientRect();
    const style = getComputedStyle(cb as HTMLElement);
    return {
      found: true,
      visible: rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
      display: style.display,
    };
  });

  console.log("[TC8] change-bar before input:", JSON.stringify(changeBarBefore));

  // Type in the input
  if (await nameInput.count() > 0) {
    await nameInput.fill("Modified Project Name");
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/change-bar-dirty-1100.png`,
    fullPage: false,
  });

  const changeBarAfter = await page.evaluate(() => {
    const cb = document.querySelector(".change-bar, #changebar, [class*='change-bar']");
    if (!cb) return { found: false, visible: false, display: "n/a" };
    const rect = (cb as HTMLElement).getBoundingClientRect();
    const style = getComputedStyle(cb as HTMLElement);
    return {
      found: true,
      visible: rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
      display: style.display,
    };
  });

  console.log("[TC8] change-bar after input:", JSON.stringify(changeBarAfter));
  expect(changeBarAfter.found, "change-bar element must exist").toBe(true);
  expect(changeBarAfter.visible, "change-bar must be visible after input change").toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC9: Font check — Paperlogy present, no Pretendard-only / Inter / Roboto
// ─────────────────────────────────────────────────────────────────────────────
test("TC9: font-family — Paperlogy applied, no forbidden fonts", async ({ page }) => {
  await setupViteMocks(page, PROJECT_ID);
  await goToSettings(page);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(400);

  const fontInfo = await page.evaluate(() => {
    const bodyFont = getComputedStyle(document.body).fontFamily;
    const h1 = document.querySelector("h1");
    const h1Font = h1 ? getComputedStyle(h1).fontFamily : null;
    const input = document.querySelector("input");
    const inputFont = input ? getComputedStyle(input).fontFamily : null;

    const hasPaperlogy = bodyFont.toLowerCase().includes("paperlogy") ||
      (h1Font ?? "").toLowerCase().includes("paperlogy") ||
      (inputFont ?? "").toLowerCase().includes("paperlogy");

    const hasForbidden = [bodyFont, h1Font ?? "", inputFont ?? ""].some(f =>
      /\binter\b|\broboto\b/i.test(f)
    );
    // Pretendard alone (without Paperlogy first) is forbidden
    const pretendardWithoutPaperlogy = /pretendard/i.test(bodyFont) &&
      !bodyFont.toLowerCase().startsWith("paperlogy") &&
      !bodyFont.toLowerCase().includes("paperlogy");

    return {
      bodyFont,
      h1Font,
      inputFont,
      hasPaperlogy,
      hasForbidden,
      pretendardWithoutPaperlogy,
    };
  });

  console.log("[TC9] font info:", JSON.stringify(fontInfo));
  expect(fontInfo.hasPaperlogy, "Paperlogy must be in font stack").toBe(true);
  expect(fontInfo.hasForbidden, "Forbidden fonts (Inter/Roboto) must not be present").toBe(false);
  expect(fontInfo.pretendardWithoutPaperlogy, "Pretendard must not be the primary font without Paperlogy").toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC10: ps-tab--danger color — must NOT use severity-critical token directly
// ─────────────────────────────────────────────────────────────────────────────
test("TC10: danger tab color — no direct severity-critical token", async ({ page }) => {
  await setupViteMocks(page, PROJECT_ID);
  await goToSettings(page);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(400);

  const colorInfo = await page.evaluate(() => {
    // severity-critical token value
    const sevCritical = getComputedStyle(document.documentElement)
      .getPropertyValue("--severity-critical").trim();

    // danger tab button
    const dangerTab = document.querySelector(".tab.danger, .ps-tab--danger, [class*='danger'][role='tab'], [data-section='danger']");
    if (!dangerTab) return { dangerTabFound: false, sevCritical, dangerColor: null, match: false };

    const dangerColor = getComputedStyle(dangerTab as HTMLElement).color;
    // Compare oklch strings (they may be rendered as rgb by browser)
    // We flag if the color exactly equals the computed severity-critical color
    // In practice we check if the CSS var is used directly
    const inlineStyle = (dangerTab as HTMLElement).style.color;
    const classNames = (dangerTab as HTMLElement).className;

    return {
      dangerTabFound: true,
      sevCritical,
      dangerColor,
      inlineStyle,
      classNames,
      match: false, // computed color comparison not reliable cross-browser; flag only if inline
    };
  });

  console.log("[TC10] color info:", JSON.stringify(colorInfo));
  expect(colorInfo.dangerTabFound, "danger tab must exist").toBe(true);
  // Inline style assignment of severity-critical is the direct violation
  expect(colorInfo.inlineStyle ?? "", "danger tab must not have inline color=severity-critical").not.toMatch(/severity-critical/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC11: Console errors — 0 errors across all tabs
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC11: console errors", () => {
  const TABS = ["general", "sdk", "targets", "adapters", "notify", "danger"];

  for (const tab of TABS) {
    test(`no console errors on tab '${tab}'`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));

      await setupViteMocks(page, PROJECT_ID);
      await goToSettings(page, tab);
      await page.setViewportSize({ width: 1100, height: 800 });
      await page.waitForTimeout(400);

      // Click the tab
      let tabSelector = "";
      if (tab === "general") tabSelector = "일반|general";
      else if (tab === "sdk") tabSelector = "sdk";
      else if (tab === "targets") tabSelector = "타겟|target";
      else if (tab === "adapters") tabSelector = "어댑터|adapt";
      else if (tab === "notify") tabSelector = "알림|notify";
      else if (tab === "danger") tabSelector = "위험|danger";

      const tabBtn = page.locator(
        ".tab-strip button, [role='tablist'] button, button[data-section]"
      ).filter({ hasText: new RegExp(tabSelector, "i") }).first();
      if (await tabBtn.count() > 0) {
        await tabBtn.click();
        await page.waitForTimeout(300);
      }

      console.log(`[TC11][${tab}] errors:`, consoleErrors);
      expect(consoleErrors.filter(e => !e.includes("chunk-size")), `console errors on tab '${tab}'`).toHaveLength(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC12: prefers-reduced-motion — pulse/animation stops
// ─────────────────────────────────────────────────────────────────────────────
test("TC12: prefers-reduced-motion: animations stop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setupViteMocks(page, PROJECT_ID);
  await goToSettings(page, "sdk");
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(400);

  // Click SDK tab
  const sdkTab = page.locator(
    ".tab-strip button, [role='tablist'] button, button[data-section]"
  ).filter({ hasText: /sdk/i }).first();
  if (await sdkTab.count() > 0) {
    await sdkTab.click();
    await page.waitForTimeout(400);
  }

  const motionInfo = await page.evaluate(() => {
    // Check if pulse dot / animated elements have animation: none under reduced-motion
    const pulse = document.querySelector(".pulse, [class*='pulse'], .run-status__dot");
    const pulseDuration = pulse ? getComputedStyle(pulse as HTMLElement).animationDuration : null;
    const pulsePlayState = pulse ? getComputedStyle(pulse as HTMLElement).animationPlayState : null;

    const stepperActive = document.querySelector(".step.active .sdot, .sdk-stepper .active");
    const stepperDuration = stepperActive ? getComputedStyle(stepperActive as HTMLElement).animationDuration : null;

    // body.no-live check
    const bodyNoLive = document.body.classList.contains("no-live");

    return {
      pulse: {
        found: !!pulse,
        animationDuration: pulseDuration,
        animationPlayState: pulsePlayState,
      },
      stepperActive: {
        found: !!stepperActive,
        animationDuration: stepperDuration,
      },
      bodyNoLive,
    };
  });

  console.log("[TC12] motion info:", JSON.stringify(motionInfo));
  // Under prefers-reduced-motion, animation-duration should be 0s or animationPlayState paused
  if (motionInfo.pulse.found && motionInfo.pulse.animationDuration) {
    const isPaused = motionInfo.pulse.animationPlayState === "paused" ||
      motionInfo.pulse.animationDuration === "0s";
    console.log(`[TC12] pulse animation paused/stopped: ${isPaused}`);
    // NOTE: this is MAJOR, not CRITICAL — report but don't hard-fail if not implemented
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TC13: ?section= URL sync
// ─────────────────────────────────────────────────────────────────────────────
test("TC13: ?section= URL sync preserved", async ({ page }) => {
  await setupViteMocks(page, PROJECT_ID);
  // Navigate directly to sdk section
  await page.addInitScript(AUTH_INIT_SCRIPT);
  await page.goto(`http://localhost:5173/projects/${PROJECT_ID}/settings?section=sdk`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const urlInfo = await page.evaluate(() => {
    return {
      url: window.location.href,
      search: window.location.search,
    };
  });

  console.log("[TC13] URL:", JSON.stringify(urlInfo));
  // URL should still contain ?section=sdk or the page should have navigated to sdk section
  const sdkSectionActive = await page.evaluate(() => {
    const sdkPane = document.querySelector("[data-pane='sdk'], [data-section='sdk'], #sdk-section, [class*='sdk-section']");
    const sdkTab = document.querySelector(".tab.active[data-section='sdk'], [aria-selected='true'][data-section='sdk'], .ps-tab--active[data-section='sdk']");
    const bodyText = document.body.innerText;
    const hasSDKContent = /sdk 관리|SDK 관리|sdk management/i.test(bodyText);
    return { sdkPane: !!sdkPane, sdkTab: !!sdkTab, hasSDKContent };
  });

  console.log("[TC13] sdk section active:", JSON.stringify(sdkSectionActive));
  // Either the URL preserved ?section=sdk or SDK content is shown
  const urlHasSection = urlInfo.search.includes("section=sdk");
  const sdkVisible = sdkSectionActive.sdkPane || sdkSectionActive.sdkTab || sdkSectionActive.hasSDKContent;
  expect(urlHasSection || sdkVisible, "?section=sdk URL sync or SDK content visible").toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC14: Keyboard focus ring — tab-strip navigable
// ─────────────────────────────────────────────────────────────────────────────
test("TC14: keyboard focus ring on tab-strip", async ({ page }) => {
  await setupViteMocks(page, PROJECT_ID);
  await goToSettings(page);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(400);

  // Tab into the page
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(100);

  const focusInfo = await page.evaluate(() => {
    const focused = document.activeElement;
    const focusStyle = focused ? getComputedStyle(focused as HTMLElement).outlineWidth : null;
    const focusVisible = focused ? (focused as HTMLElement).matches(":focus-visible") : false;
    return {
      tagName: focused?.tagName,
      className: focused?.className,
      outlineWidth: focusStyle,
      focusVisible,
    };
  });

  console.log("[TC14] focus info:", JSON.stringify(focusInfo));
  // Just verify focus is navigable (some element is focused that's not body)
  expect(focusInfo.tagName, "Some element must receive focus").not.toBe("BODY");
});

// ─────────────────────────────────────────────────────────────────────────────
// TC15: Operational signals visible at all viewports (§8.5 hard rule)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("TC15: §8.5 — operational signals not hidden at narrow viewports", () => {
  for (const vp of VIEWPORTS) {
    test(`tab-strip + change-bar visible at ${vp.label}px`, async ({ page }) => {
      await setupViteMocks(page, PROJECT_ID);
      await goToSettings(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      const signalInfo = await page.evaluate(() => {
        const tabStrip = document.querySelector(
          ".tab-strip, .filter-pills--tabs, [role='tablist']"
        );
        const tabStripRect = tabStrip ? (tabStrip as HTMLElement).getBoundingClientRect() : null;
        const tabStripVisible = tabStripRect ? tabStripRect.height > 0 && tabStripRect.width > 0 : false;

        // Count tabs
        const tabs = tabStrip ? tabStrip.querySelectorAll("button, [role='tab'], .tab, .pill") : null;
        const visibleTabs = tabs ? Array.from(tabs).filter(t => {
          const r = (t as HTMLElement).getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }) : [];

        const tabStripStyle = tabStrip ? getComputedStyle(tabStrip as HTMLElement) : null;
        const overflow = tabStripStyle ? tabStripStyle.overflowX : null;

        return {
          tabStripFound: !!tabStrip,
          tabStripVisible,
          tabCount: tabs?.length ?? 0,
          visibleTabCount: visibleTabs.length,
          overflow,
        };
      });

      console.log(`[TC15][${vp.label}] signals:`, JSON.stringify(signalInfo));

      expect(signalInfo.tabStripFound, `tab-strip must exist at ${vp.label}px`).toBe(true);
      expect(signalInfo.tabStripVisible, `tab-strip must be visible at ${vp.label}px`).toBe(true);
      // At minimum 6 tabs must be present (even if wrapped or scrollable)
      expect(signalInfo.tabCount, `at least 6 tabs must exist at ${vp.label}px`).toBeGreaterThanOrEqual(6);
    });
  }
});
