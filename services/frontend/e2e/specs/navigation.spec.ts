/**
 * Navigation & Routing smoke tests.
 * Verifies HashRouter routes resolve, sidebar renders, and page transitions work.
 */
import { test, expect } from "../fixtures/base";
import { navigateTo, goToProject, waitForContent } from "../helpers/navigation";

test.describe("Global Navigation", () => {
  test("root redirects to /projects", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await page.goto("/");
    await expect(page).toHaveURL(/\/#\/projects/);
  });

  test("projects page renders project cards", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/projects");
    await waitForContent(page);

    await expect(page.getByText("차량 게이트웨이 ECU")).toBeVisible();
    await expect(page.getByText("바디 컨트롤 모듈")).toBeVisible();
  });

  test("global settings page is reachable", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);

    // "백엔드 서버" matches both title and description, use exact match
    await expect(page.getByText("백엔드 서버", { exact: true })).toBeVisible();
  });
});

test.describe("Project Navigation", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
  });

  test("clicking project navigates to overview", async ({ page }) => {
    await navigateTo(page, "/projects");
    await waitForContent(page);

    await page.getByText("차량 게이트웨이 ECU").click();
    await expect(page).toHaveURL(/\/#\/projects\/p-1\/overview/);
  });

  test("sidebar shows all project sub-navigation items", async ({ page }) => {
    await goToProject(page, "p-1");
    await waitForContent(page);

    const sidebar = page.locator(".sidebar");
    // Actual sidebar labels from Sidebar.tsx
    const expectedItems = ["대시보드", "파일 탐색기", "취약점 목록", "정적 분석", "Quality Gate", "Approval Queue", "분석 이력", "보고서"];
    for (const item of expectedItems) {
      await expect(sidebar.getByText(item, { exact: false })).toBeVisible();
    }
  });

  const subPages = [
    { path: "overview", text: "대시보드" },
    { path: "static-analysis", text: "정적 분석" },
    { path: "files", text: "파일" },
    { path: "vulnerabilities", text: "취약점" },
    { path: "analysis-history", text: "분석 이력" },
    { path: "quality-gate", text: "Quality Gate" },
    { path: "approvals", text: "Approval" },
    { path: "settings", text: "SDK" },
  ];

  for (const { path, text } of subPages) {
    test(`sub-page /${path} loads without error`, async ({ page }) => {
      await goToProject(page, "p-1", path);
      await waitForContent(page);

      // Should not show error boundary fallback
      const errorBoundary = page.locator(".error-boundary__content");
      await expect(errorBoundary).not.toBeVisible({ timeout: 3000 });
    });
  }
});
