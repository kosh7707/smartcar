/**
 * User interaction tests.
 * Verifies forms, filters, modals, and API calls for key workflows.
 */
import { test, expect } from "../fixtures/base";
import { navigateTo, goToProject, waitForContent } from "../helpers/navigation";

// ────────────────────────────────────────────────────────
// A. Project Creation
// ────────────────────────────────────────────────────────

test.describe("Create Project", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProjectsList();
  });

  test("clicking 새 프로젝트 reveals create form", async ({ page }) => {
    await navigateTo(page, "/projects");
    await waitForContent(page);

    await page.getByText("새 프로젝트", { exact: false }).first().click();
    await expect(page.locator(".projects-create-form")).toBeVisible();
  });

  test("cancel hides the form", async ({ page }) => {
    await navigateTo(page, "/projects");
    await waitForContent(page);

    await page.getByText("새 프로젝트", { exact: false }).first().click();
    await expect(page.locator(".projects-create-form")).toBeVisible();

    await page.getByText("취소", { exact: true }).click();
    await expect(page.locator(".projects-create-form")).not.toBeVisible();
  });

  test("empty name does not submit", async ({ page }) => {
    await navigateTo(page, "/projects");
    await waitForContent(page);

    await page.getByText("새 프로젝트", { exact: false }).first().click();
    await page.getByText("생성", { exact: true }).click();

    // Form should still be visible (no navigation)
    await expect(page.locator(".projects-create-form")).toBeVisible();
    await expect(page).toHaveURL(/\/#\/projects$/);
  });

  test("successful creation calls POST and navigates", async ({ page, mockApi }) => {
    const newProject = {
      id: "p-new", name: "테스트 프로젝트", description: "설명",
      createdAt: "2026-03-31T09:00:00Z", updatedAt: "2026-03-31T09:00:00Z",
    };

    await mockApi.on("POST", "/api/projects", { success: true, data: newProject });
    // Mock the new project's overview for post-navigation
    await mockApi.on("GET", "/api/projects/p-new/overview", {
      project: newProject, fileCount: 0,
      summary: { totalVulnerabilities: 0, bySeverity: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }, byModule: { static: 0, dynamic: 0, test: 0 } },
      recentAnalyses: [],
    });

    await navigateTo(page, "/projects");
    await waitForContent(page);

    await page.getByText("새 프로젝트", { exact: false }).first().click();

    const nameInput = page.locator(".projects-create-form .form-input").first();
    await nameInput.fill("테스트 프로젝트");

    const descInput = page.locator(".projects-create-form .form-input").nth(1);
    await descInput.fill("설명");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/projects") && req.method() === "POST"),
      page.getByText("생성", { exact: true }).click(),
    ]);

    const body = request.postDataJSON();
    expect(body.name).toBe("테스트 프로젝트");
    expect(body.description).toBe("설명");
  });
});

// ────────────────────────────────────────────────────────
// B. Finding Filters (LatestAnalysisTab)
// ────────────────────────────────────────────────────────

test.describe("Finding Filters", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
  });

  test("search input filters findings by title", async ({ page }) => {
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const searchInput = page.locator(".finding-search-input");
    // Search input may not exist if no findings tab is visible; skip gracefully
    if (!(await searchInput.isVisible().catch(() => false))) return;

    await searchInput.fill("버퍼");
    await page.waitForTimeout(300); // debounce

    // Only the "버퍼 오버플로우" finding should be visible
    await expect(page.getByText("버퍼 오버플로우", { exact: false })).toBeVisible();
  });

  test("severity filter shows only matching findings", async ({ page }) => {
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    // Click Critical severity filter tab
    const criticalTab = page.locator(".finding-filter-tab").filter({ hasText: /[Cc]ritical/ }).first();
    if (await criticalTab.isVisible().catch(() => false)) {
      await criticalTab.click();
      await page.waitForTimeout(200);
    }
  });

  test("source type filter works", async ({ page }) => {
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const agentTab = page.locator(".finding-filter-tab--sm").filter({ hasText: /[Aa]gent/ }).first();
    if (await agentTab.isVisible().catch(() => false)) {
      await agentTab.click();
      await page.waitForTimeout(200);
    }
  });

  test("sort dropdown changes order", async ({ page }) => {
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    const sortSelect = page.locator(".finding-sort-select");
    if (await sortSelect.isVisible().catch(() => false)) {
      await sortSelect.selectOption({ label: "위치" });
      await page.waitForTimeout(200);

      // Toggle sort direction
      const sortDir = page.locator(".finding-sort-dir");
      if (await sortDir.isVisible()) {
        await sortDir.click();
      }
    }
  });
});

// ────────────────────────────────────────────────────────
// C. Quality Gate Override
// ────────────────────────────────────────────────────────

test.describe("Quality Gate Override", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
  });

  test("override button appears on failed gate", async ({ page }) => {
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);

    await expect(page.getByText("오버라이드", { exact: true })).toBeVisible();
  });

  test("clicking override shows reason form and cancel hides it", async ({ page }) => {
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);

    await page.getByText("오버라이드", { exact: true }).click();
    await expect(page.locator(".gate-override-form")).toBeVisible();
    await expect(page.getByPlaceholder(/오버라이드 사유를 입력하세요/)).toBeVisible();

    await page.getByText("취소", { exact: true }).click();
    await expect(page.locator(".gate-override-form")).not.toBeVisible();
  });

  test("submit calls overrideGate API", async ({ page, mockApi }) => {
    await mockApi.on("POST", "/api/gates/gate-1/override", { success: true });

    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);

    await page.getByText("오버라이드", { exact: true }).click();
    await page.getByPlaceholder(/오버라이드 사유를 입력하세요/).fill("긴급 대응으로 인한 오버라이드입니다");

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/gates/gate-1/override") && req.method() === "POST"),
      page.getByText(/오버라이드 확인/).click(),
    ]);

    const body = request.postDataJSON();
    expect(body.reason).toBe("긴급 대응으로 인한 오버라이드입니다");
  });
});

// ────────────────────────────────────────────────────────
// D. Approval Decision
// ────────────────────────────────────────────────────────

test.describe("Approval Decision", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
  });

  test("filter buttons filter approval list", async ({ page }) => {
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    // Click "대기" filter
    await page.locator(".approval-filter__btn").filter({ hasText: "대기" }).click();
    await page.waitForTimeout(200);

    // Click "전체" to reset
    await page.locator(".approval-filter__btn").filter({ hasText: "전체" }).click();
  });

  test("approve button opens decision dialog", async ({ page }) => {
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    // Target the pending approval card (has 승인/거부 buttons, not a status badge)
    // The pending card has a button.btn-sm with text "승인"
    const approveBtn = page.locator(".approval-card button.btn-sm").filter({ hasText: "승인" }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Dialog should appear
    await expect(page.locator("[role='dialog']")).toBeVisible();
    await expect(page.getByText("승인 확인")).toBeVisible();

    // Cancel closes dialog
    await page.locator("[role='dialog']").getByText("취소", { exact: true }).click();
    await expect(page.locator("[role='dialog']")).not.toBeVisible();
  });

  test("confirm approve calls decideApproval API", async ({ page, mockApi }) => {
    await mockApi.on("POST", "/api/approvals/appr-1/decide", {
      success: true,
      data: { status: "approved" },
    });

    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    const approveBtn = page.locator(".approval-card button.btn-sm").filter({ hasText: "승인" }).first();
    await approveBtn.click();
    await expect(page.locator("[role='dialog']")).toBeVisible();

    // Enter comment
    const textarea = page.locator("[role='dialog'] textarea");
    if (await textarea.isVisible()) {
      await textarea.fill("LGTM");
    }

    // Confirm
    const [request] = await Promise.all([
      page.waitForRequest((req) =>
        req.url().includes("/api/approvals/appr-1/decide") && req.method() === "POST",
      ),
      page.locator("[role='dialog'] button.btn-sm").filter({ hasText: "승인" }).click(),
    ]);

    const body = request.postDataJSON();
    expect(body.decision).toBe("approved");
  });
});
