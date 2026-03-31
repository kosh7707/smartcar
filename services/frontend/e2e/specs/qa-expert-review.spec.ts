/**
 * Expert Security Analyst QA Review — Granular Component Review
 * 10-year embedded SAST/triage specialist perspective.
 * Phase 0: Dark theme fix (aegis:theme key)
 * Phase 1: Extended captures (interactions, dialogs, responsive, 1440px)
 */
import { test, expect } from "../fixtures/base";
import { navigateTo, goToProject, waitForContent } from "../helpers/navigation";
import * as data from "../fixtures/mock-data";

const D = "e2e/qa-captures";

/** Capture a named screenshot. */
async function cap(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: `${D}/${name}.png`, fullPage: true, animations: "disabled" });
}

// ============================================================
// LIGHT THEME — Full page tour
// ============================================================
test.describe("Expert QA — Light Theme", () => {
  test("01. Projects list", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/projects");
    await waitForContent(page);
    await cap(page, "01-light-projects-list");
  });

  test("02. Projects list empty", async ({ page, mockApi }) => {
    await mockApi.on("GET", "/api/projects", { success: true, data: [] });
    await mockApi.on("GET", "/api/analysis/status", { success: true, data: [] });
    await navigateTo(page, "/projects");
    await waitForContent(page);
    await cap(page, "02-light-projects-empty");
  });

  test("03. Overview dashboard", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);
    await cap(page, "03-light-overview");
  });

  test("04. Static analysis — latest tab", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);
    await cap(page, "04-light-static-analysis-latest");
  });

  test("05. Static analysis — overall tab", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);
    const tabs = page.locator('[role="tab"], .tab-btn, .tab-button, button').filter({ hasText: /전체|현황|overall/i });
    if (await tabs.count() > 0) {
      await tabs.first().click();
      await waitForContent(page);
    }
    await cap(page, "05-light-static-analysis-overall");
  });

  test("06. Files page", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "files");
    await waitForContent(page);
    await cap(page, "06-light-files");
  });

  test("07. Vulnerabilities page", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "vulnerabilities");
    await waitForContent(page);
    await cap(page, "07-light-vulnerabilities");
  });

  test("08. Analysis history", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "analysis-history");
    await waitForContent(page);
    await cap(page, "08-light-analysis-history");
  });

  test("09. Report page", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "report");
    await waitForContent(page);
    await cap(page, "09-light-report");
  });

  test("10. Quality gate", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);
    await cap(page, "10-light-quality-gate");
  });

  test("11. Approvals page", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);
    await cap(page, "11-light-approvals");
  });

  test("12. Project settings", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "settings");
    await waitForContent(page);
    await cap(page, "12-light-project-settings");
  });

  test("13. Global settings", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);
    await cap(page, "13-light-global-settings");
  });
});

// ============================================================
// DARK THEME — Fixed: uses aegis:theme (colon) + addInitScript
// ============================================================
test.describe("Expert QA — Dark Theme", () => {
  test.beforeEach(async ({ page }) => {
    // Correct key: aegis:theme (colon, NOT hyphen)
    await page.addInitScript(() => {
      localStorage.setItem("aegis:theme", "dark");
    });
  });

  test("14. Projects list (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/projects");
    await waitForContent(page);
    await cap(page, "14-dark-projects-list");
  });

  test("15. Overview dashboard (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);
    await cap(page, "15-dark-overview");
  });

  test("16. Static analysis (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);
    await cap(page, "16-dark-static-analysis");
  });

  test("17. Files page (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "files");
    await waitForContent(page);
    await cap(page, "17-dark-files");
  });

  test("18. Vulnerabilities (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "vulnerabilities");
    await waitForContent(page);
    await cap(page, "18-dark-vulnerabilities");
  });

  test("19. Report (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "report");
    await waitForContent(page);
    await cap(page, "19-dark-report");
  });

  test("20. Quality gate (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);
    await cap(page, "20-dark-quality-gate");
  });

  test("21. Approvals (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);
    await cap(page, "21-dark-approvals");
  });

  test("22. Analysis history (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "analysis-history");
    await waitForContent(page);
    await cap(page, "22-dark-analysis-history");
  });

  test("23. Global settings (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);
    await cap(page, "23-dark-global-settings");
  });

  test("23b. Project settings (dark)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "settings");
    await waitForContent(page);
    await cap(page, "23b-dark-project-settings");
  });
});

// ============================================================
// EXTENDED CAPTURES — Interactions, dialogs, drill-downs
// ============================================================
test.describe("Expert QA — Interaction States", () => {
  test("30. Static analysis — Finding card click (BUG-1 recheck)", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    // Add finding detail mock
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

    // Click first finding card
    const card = page.locator('[class*="vuln-card"], [class*="finding-card"], [class*="finding-row"]').first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.click();
      await waitForContent(page);
    }
    await cap(page, "30-light-finding-detail");
  });

  test("31. Analysis history — Run detail drill-down", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "analysis-history");
    await waitForContent(page);

    // Click first run item
    const runItem = page.locator('[class*="run-item"], [class*="list-item"], [class*="history"] >> a, li >> a').first();
    if (await runItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runItem.click();
      await waitForContent(page);
    }
    await cap(page, "31-light-run-detail");
  });

  test("32. Quality Gate — override button click", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);

    const overrideBtn = page.locator('button').filter({ hasText: /오버라이드|override/i });
    if (await overrideBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overrideBtn.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "32-light-gate-override-dialog");
  });

  test("33. Approvals — approve/reject buttons", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    // Click approve button on the pending item
    const approveBtn = page.locator('button').filter({ hasText: /승인/ }).first();
    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(300);
    }
    await cap(page, "33-light-approval-confirm-dialog");
  });

  test("34. Files page — file selection + preview", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    // Mock file content for preview
    await mockApi.on("GET", "/api/projects/p-1/source/files/src%2Fmain.c", {
      success: true,
      data: { content: "#include <stdio.h>\n\nint main() {\n  // Gateway ECU entry point\n  init_can_bus();\n  while(1) {\n    process_messages();\n  }\n  return 0;\n}", language: "c" },
    });
    await goToProject(page, "p-1", "files");
    await waitForContent(page);

    // Click a file in the tree
    const fileNode = page.locator('text=main.c').first();
    if (await fileNode.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileNode.click();
      await waitForContent(page);
    }
    await cap(page, "34-light-files-preview");
  });

  test("35. Static analysis — source upload view", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    // Override source files to empty → trigger upload view
    await mockApi.on("GET", "/api/projects/p-1/source/files", { success: true, data: [], composition: {}, totalFiles: 0, totalSize: 0, targetMapping: {} });
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);
    await cap(page, "35-light-source-upload");
  });

  test("36. Sidebar navigation — all pages", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    for (const sub of ["overview", "static-analysis", "files", "vulnerabilities", "analysis-history", "report", "quality-gate", "approvals", "settings"]) {
      await goToProject(page, "p-1", sub);
      await waitForContent(page);
      await cap(page, `36-sidebar-${sub}`);
    }
  });
});

// ============================================================
// RESPONSIVE — Multiple breakpoints
// ============================================================
test.describe("Expert QA — Responsive", () => {
  test("40. 768px — key pages", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await page.setViewportSize({ width: 768, height: 1024 });

    for (const [sub, name] of [["overview", "overview"], ["static-analysis", "static"], ["vulnerabilities", "vulns"], ["quality-gate", "gate"], ["approvals", "approvals"]] as const) {
      await goToProject(page, "p-1", sub);
      await waitForContent(page);
      await cap(page, `40-responsive-768-${name}`);
    }
  });

  test("41. 1440px — key pages", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const [sub, name] of [["overview", "overview"], ["static-analysis", "static"], ["files", "files"], ["report", "report"]] as const) {
      await goToProject(page, "p-1", sub);
      await waitForContent(page);
      await cap(page, `41-wide-1440-${name}`);
    }
  });
});
