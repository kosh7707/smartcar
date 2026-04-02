/**
 * QA Design Audit — Comprehensive Screenshot Capture
 *
 * Captures every accessible page, sub-view, dialog, empty state,
 * and responsive breakpoint for design review.
 *
 * Run: npx playwright test e2e/specs/qa-design-audit.spec.ts
 * Output: e2e/qa-captures/design-audit/
 */
import { test, expect } from "../fixtures/base";
import { navigateTo, goToProject, waitForContent } from "../helpers/navigation";
import * as data from "../fixtures/mock-data";

const D = "e2e/qa-captures/design-audit";

async function cap(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: `${D}/${name}.png`, fullPage: true, animations: "disabled" });
}

async function capBottom(page: import("@playwright/test").Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await cap(page, name);
}

async function assertNoError(page: import("@playwright/test").Page) {
  await expect(page.locator(".error-boundary__content")).not.toBeVisible({ timeout: 3000 });
}

// ════════════════════════════════════════════════════════════════
// BLOCK A: Light Theme — All Pages
// ════════════════════════════════════════════════════════════════
test.describe("Design Audit — Light Theme", () => {
  test("A01. Projects list", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/projects");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-projects");
  });

  test("A02. Projects list — empty", async ({ page, mockApi }) => {
    await mockApi.on("GET", "/api/projects", { success: true, data: [] });
    await mockApi.on("GET", "/api/analysis/status", { success: true, data: [] });
    await navigateTo(page, "/projects");
    await waitForContent(page);
    await cap(page, "light-projects-empty");
  });

  test("A03. Global settings", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-global-settings");
  });

  test("A04. Overview dashboard", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-overview");
    await capBottom(page, "light-overview-bottom");
  });

  test("A05. Static analysis — latest tab", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-static-latest");
    await capBottom(page, "light-static-latest-bottom");
  });

  test("A06. Static analysis — overall tab", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);
    const tab = page.locator('[role="tab"], .tab-btn, .tab-button, button').filter({ hasText: /전체|현황|overall/i });
    if (await tab.count() > 0) {
      await tab.first().click();
      await waitForContent(page);
    }
    await cap(page, "light-static-overall");
    await capBottom(page, "light-static-overall-bottom");
  });

  test("A07. Files page", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "files");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-files");
  });

  test("A08. Vulnerabilities page", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "vulnerabilities");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-vulns");
    await capBottom(page, "light-vulns-bottom");
  });

  test("A09. Analysis history", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "analysis-history");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-analysis-history");
  });

  test("A10. Report page", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "report");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-report");
    await capBottom(page, "light-report-bottom");
  });

  test("A11. Quality Gate", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-quality-gate");
  });

  test("A12. Approval Queue", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-approvals");
    await capBottom(page, "light-approvals-bottom");
  });

  test("A13. Project settings", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "settings");
    await waitForContent(page);
    await assertNoError(page);
    await cap(page, "light-project-settings");
  });

  test("A14. Dynamic analysis — placeholder", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "dynamic-analysis");
    await waitForContent(page);
    await cap(page, "light-dynamic-placeholder");
  });

  test("A15. Dynamic test — placeholder", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "dynamic-test");
    await waitForContent(page);
    await cap(page, "light-dyntest-placeholder");
  });

  test("A16. Create project form", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/projects");
    await waitForContent(page);
    const btn = page.locator("button").filter({ hasText: /새 프로젝트|프로젝트 생성|create/i });
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "light-create-project");
  });
});

// ════════════════════════════════════════════════════════════════
// BLOCK B: Dark Theme — All Pages
// ════════════════════════════════════════════════════════════════
test.describe("Design Audit — Dark Theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("aegis:theme", "dark");
    });
  });

  test("B01. Projects list (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/projects");
    await waitForContent(page);
    await cap(page, "dark-projects");
  });

  test("B02. Global settings (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);
    await cap(page, "dark-global-settings");
  });

  test("B03. Overview (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);
    await cap(page, "dark-overview");
    await capBottom(page, "dark-overview-bottom");
  });

  test("B04. Static analysis (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);
    await cap(page, "dark-static-latest");
  });

  test("B05. Files (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "files");
    await waitForContent(page);
    await cap(page, "dark-files");
  });

  test("B06. Vulnerabilities (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "vulnerabilities");
    await waitForContent(page);
    await cap(page, "dark-vulns");
  });

  test("B07. Analysis history (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "analysis-history");
    await waitForContent(page);
    await cap(page, "dark-analysis-history");
  });

  test("B08. Report (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "report");
    await waitForContent(page);
    await cap(page, "dark-report");
  });

  test("B09. Quality Gate (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);
    await cap(page, "dark-quality-gate");
  });

  test("B10. Approvals (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);
    await cap(page, "dark-approvals");
  });

  test("B11. Project settings (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "settings");
    await waitForContent(page);
    await cap(page, "dark-project-settings");
  });

  test("B12. Create project form (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/projects");
    await waitForContent(page);
    const btn = page.locator("button").filter({ hasText: /새 프로젝트|프로젝트 생성|create/i });
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "dark-create-project");
  });
});

// ════════════════════════════════════════════════════════════════
// BLOCK C: Interactions — Static Analysis Sub-views
// ════════════════════════════════════════════════════════════════
test.describe("Design Audit — Static Analysis Interactions", () => {
  test("C01. Finding detail via card click", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/findings/find-1", {
      success: true,
      data: {
        finding: data.FINDINGS[0],
        evidenceRefs: [
          { id: "evr-1", findingId: "find-1", artifactId: "ar-1", artifactType: "analysis-result", locatorType: "line-range", locator: { file: "src/can_handler.c", startLine: 135, endLine: 150 }, createdAt: "2026-03-25T10:00:00Z" },
        ],
        auditLog: [
          { id: "log-1", timestamp: "2026-03-25T10:00:00Z", actor: "system", action: "finding.created", resource: "finding", resourceId: "find-1", detail: { status: "open" } },
        ],
      },
    });
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const card = page.locator('[class*="vuln-card"], [class*="finding-card"]').first();
    if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
      await card.click();
      await waitForContent(page);
    }
    await assertNoError(page);
    await cap(page, "interact-finding-detail");
    await capBottom(page, "interact-finding-detail-bottom");
  });

  test("C02. Run detail via history click", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const runItem = page.locator('[class*="run-item"], [class*="list-item"]').first();
    if (await runItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await runItem.click();
      await waitForContent(page);
    }
    await assertNoError(page);
    await cap(page, "interact-run-detail");
    await capBottom(page, "interact-run-detail-bottom");
  });

  test("C03. Finding search filter", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const search = page.locator('.finding-search-input, input[placeholder*="검색"], input[type="search"]').first();
    if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
      await search.fill("버퍼");
      await page.waitForTimeout(500);
    }
    await cap(page, "interact-finding-search");
  });

  test("C04. Severity filter — Critical", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const critTab = page.locator('.finding-filter-tab, [class*="filter-tab"]').filter({ hasText: /critical/i });
    if (await critTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await critTab.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "interact-finding-filter-critical");
  });

  test("C05. Source type filter", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const sourceTab = page.locator('.finding-filter-tab--sm, [class*="filter-tab"]').filter({ hasText: /agent|llm|ai/i });
    if (await sourceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sourceTab.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "interact-finding-filter-source");
  });

  test("C06. Sort change", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const sortSelect = page.locator('.finding-sort-select, select[class*="sort"]').first();
    if (await sortSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortSelect.selectOption({ index: 1 });
      await page.waitForTimeout(300);
    }
    await cap(page, "interact-finding-sort");
  });

  test("C07. Source upload — empty files state", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/projects/p-1/source/files", {
      success: true, data: [], composition: {}, totalFiles: 0, totalSize: 0, targetMapping: {},
    });
    await mockApi.on("GET", "/api/projects/p-1/runs", { success: true, data: [] });
    await mockApi.on("GET", "/api/analysis/summary", { success: true, data: null });
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);
    await cap(page, "interact-source-upload-empty");
  });
});

// ════════════════════════════════════════════════════════════════
// BLOCK D: Interactions — Gate / Approval / Files
// ════════════════════════════════════════════════════════════════
test.describe("Design Audit — Gate/Approval/Files Interactions", () => {
  test("D01. Quality Gate — override dialog", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);

    const overrideBtn = page.locator("button").filter({ hasText: /오버라이드|override/i });
    if (await overrideBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overrideBtn.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "interact-gate-override");
  });

  test("D02. Approvals — pending filter", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    const pendingTab = page.locator('.approval-filter__btn, button').filter({ hasText: /대기|pending/i });
    if (await pendingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingTab.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "interact-approvals-pending");
  });

  test("D03. Approvals — approve dialog", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("POST", "/api/projects/p-1/approvals", { success: true });
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    // Click approve on the card action button (not the filter)
    const approveBtn = page.locator('.approval-card button, [class*="approval"] button').filter({ hasText: /승인/ }).first();
    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(400);
    }
    await cap(page, "interact-approval-confirm");
  });

  test("D04. Approvals — reject dialog", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    const rejectBtn = page.locator('.approval-card button, [class*="approval"] button').filter({ hasText: /거부|reject/i }).first();
    if (await rejectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rejectBtn.click();
      await page.waitForTimeout(400);
    }
    await cap(page, "interact-approval-reject");
  });

  test("D05. Files — file click to code preview", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/projects/p-1/source/file", {
      success: true,
      data: { content: "#include <stdio.h>\n#include <can_bus.h>\n\nstatic uint8_t rx_buffer[256];\n\nvoid init_can_bus(void) {\n    CAN_Init(CAN1, 500000);\n    CAN_SetFilter(0x100, 0x7FF);\n}\n\nvoid process_messages(void) {\n    CAN_Frame frame;\n    if (CAN_Receive(&frame) == CAN_OK) {\n        memcpy(rx_buffer, frame.data, frame.dlc);\n        handle_frame(&frame);\n    }\n}", language: "c" },
    });
    await goToProject(page, "p-1", "files");
    await waitForContent(page);

    const fileNode = page.locator('text=main.c, text=can_handler').first();
    if (await fileNode.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileNode.click();
      await waitForContent(page);
    }
    await cap(page, "interact-files-preview");
  });

  test("D06. Vulnerabilities — pre-filtered severity", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await page.goto("/#/projects/p-1/vulnerabilities?severity=critical");
    await waitForContent(page);
    await cap(page, "interact-vulns-critical");
  });

  test("D07. Vulnerabilities — bulk select", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "vulnerabilities");
    await waitForContent(page);

    const checkbox = page.locator('input[type="checkbox"], [role="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "interact-vulns-bulk");
  });
});

// ════════════════════════════════════════════════════════════════
// BLOCK E: Empty & Error States
// ════════════════════════════════════════════════════════════════
test.describe("Design Audit — Empty & Error States", () => {
  test("E01. Empty project overview", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/projects/p-1/overview", {
      success: true,
      data: { project: data.PROJECTS[0], files: { total: 0, byLanguage: {} }, findings: { total: 0, bySeverity: {}, byModule: {}, byStatus: {} }, analyses: [], targetSummary: { total: 0, ready: 0, failed: 0, building: 0 } },
    });
    await mockApi.on("GET", "/api/projects/p-1/activity", { success: true, data: [] });
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);
    await cap(page, "state-empty-overview");
  });

  test("E02. Empty Quality Gate", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/projects/p-1/gates", { success: true, data: [] });
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);
    await cap(page, "state-empty-quality-gate");
  });

  test("E03. Empty Approvals", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/projects/p-1/approvals", { success: true, data: [] });
    await mockApi.on("GET", "/api/projects/p-1/approvals/count", { success: true, data: { total: 0, pending: 0, approved: 0, rejected: 0, expired: 0 } });
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);
    await cap(page, "state-empty-approvals");
  });

  test("E04. Empty analysis history", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/projects/p-1/runs", { success: true, data: [] });
    await goToProject(page, "p-1", "analysis-history");
    await waitForContent(page);
    await cap(page, "state-empty-analysis-history");
  });

  test("E05. API error — overview 500", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await mockApi.on("GET", "/api/projects/p-1/overview", { success: false, error: "Internal Server Error" }, 500);
    await mockApi.on("GET", "/api/projects/p-1/activity", { success: false, error: "Internal Server Error" }, 500);
    await goToProject(page, "p-1", "overview");
    await page.waitForTimeout(1500);
    await cap(page, "state-error-overview");
  });
});

// ════════════════════════════════════════════════════════════════
// BLOCK F: Responsive 768px
// ════════════════════════════════════════════════════════════════
test.describe("Design Audit — Responsive 768px", () => {
  const subs = [
    ["overview", "responsive-768-overview"],
    ["static-analysis", "responsive-768-static"],
    ["files", "responsive-768-files"],
    ["vulnerabilities", "responsive-768-vulns"],
    ["analysis-history", "responsive-768-history"],
    ["report", "responsive-768-report"],
    ["quality-gate", "responsive-768-gate"],
    ["approvals", "responsive-768-approvals"],
  ] as const;

  for (const [sub, name] of subs) {
    test(`F. ${sub} @ 768px`, async ({ page, mockApi }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await mockApi.setupProject("p-1");
      await goToProject(page, "p-1", sub);
      await waitForContent(page);
      await cap(page, name);
    });
  }
});

// ════════════════════════════════════════════════════════════════
// BLOCK G: Wide 1440px
// ════════════════════════════════════════════════════════════════
test.describe("Design Audit — Wide 1440px", () => {
  const subs = [
    ["overview", "wide-1440-overview"],
    ["static-analysis", "wide-1440-static"],
    ["files", "wide-1440-files"],
    ["vulnerabilities", "wide-1440-vulns"],
    ["report", "wide-1440-report"],
    ["quality-gate", "wide-1440-gate"],
  ] as const;

  for (const [sub, name] of subs) {
    test(`G. ${sub} @ 1440px`, async ({ page, mockApi }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await mockApi.setupProject("p-1");
      await goToProject(page, "p-1", sub);
      await waitForContent(page);
      await cap(page, name);
    });
  }
});

// ════════════════════════════════════════════════════════════════
// BLOCK H: Dark Theme — Interaction States
// ════════════════════════════════════════════════════════════════
test.describe("Design Audit — Dark Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("aegis:theme", "dark");
    });
  });

  test("H01. Finding detail (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/findings/find-1", {
      success: true,
      data: {
        finding: data.FINDINGS[0],
        evidenceRefs: [
          { id: "evr-1", findingId: "find-1", artifactId: "ar-1", artifactType: "analysis-result", locatorType: "line-range", locator: { file: "src/can_handler.c", startLine: 135, endLine: 150 }, createdAt: "2026-03-25T10:00:00Z" },
        ],
        auditLog: [
          { id: "log-1", timestamp: "2026-03-25T10:00:00Z", actor: "system", action: "finding.created", resource: "finding", resourceId: "find-1", detail: { status: "open" } },
        ],
      },
    });
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const card = page.locator('[class*="vuln-card"], [class*="finding-card"]').first();
    if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
      await card.click();
      await waitForContent(page);
    }
    await cap(page, "dark-interact-finding-detail");
    await capBottom(page, "dark-interact-finding-detail-bottom");
  });

  test("H02. Run detail (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const runItem = page.locator('[class*="run-item"], [class*="list-item"]').first();
    if (await runItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await runItem.click();
      await waitForContent(page);
    }
    await cap(page, "dark-interact-run-detail");
  });

  test("H03. Gate override dialog (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);

    const btn = page.locator("button").filter({ hasText: /오버라이드|override/i });
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "dark-interact-gate-override");
  });

  test("H04. Approval dialog (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    const approveBtn = page.locator('.approval-card button, [class*="approval"] button').filter({ hasText: /승인/ }).first();
    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(400);
    }
    await cap(page, "dark-interact-approval-confirm");
  });

  test("H05. File preview (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/projects/p-1/source/file", {
      success: true,
      data: { content: "#include <stdio.h>\n\nint main() {\n  init_can_bus();\n  return 0;\n}", language: "c" },
    });
    await goToProject(page, "p-1", "files");
    await waitForContent(page);

    const fileNode = page.locator('text=main.c, text=can_handler').first();
    if (await fileNode.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileNode.click();
      await waitForContent(page);
    }
    await cap(page, "dark-interact-files-preview");
  });

  test("H06. Bulk select bar (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "vulnerabilities");
    await waitForContent(page);

    const checkbox = page.locator('input[type="checkbox"], [role="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "dark-interact-vulns-bulk");
  });
});
