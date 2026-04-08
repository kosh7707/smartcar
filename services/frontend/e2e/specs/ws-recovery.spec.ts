/**
 * WebSocket recovery scenario tests.
 * Verifies that pages recover gracefully when WS is unavailable,
 * falling back to REST endpoints for state restoration.
 *
 * Note: api-mocker already blocks all WS connections by default (route.abort),
 * so these tests verify the recovery path naturally.
 */
import { test, expect } from "../fixtures/base";
import { goToProject, waitForContent } from "../helpers/navigation";

test.describe("WS Recovery — Upload Re-entry", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
    // Upload status recovery endpoint
    await mockApi.on("GET", "/source/upload-status/", {
      success: true,
      data: { phase: "complete", fileCount: 42 },
    });
  });

  test("source page loads without WS — shows files from REST", async ({ page }) => {
    await goToProject(page, "p-1");
    await page.getByText("소스 파일").click();
    await waitForContent(page);
    // Page should render file list from REST mock, not stuck in loading
    await expect(page.locator(".source-files-card, .source-upload")).toBeVisible();
  });
});

test.describe("WS Recovery — SDK Re-entry", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/api/projects/p-1/sdk", {
      success: true,
      data: { builtIn: [], registered: [{ id: "sdk-1", name: "Test SDK", status: "ready" }] },
    });
    await mockApi.on("GET", "/api/gate/profiles", { success: true, data: [] });
  });

  test("project settings loads SDK list from REST without WS", async ({ page }) => {
    await goToProject(page, "p-1");
    await page.getByText("설정").click();
    await waitForContent(page);
    // SDK list should be visible from REST, even though WS is blocked
    await expect(page.getByText("Test SDK")).toBeVisible();
  });
});

test.describe("WS Recovery — Analysis Page", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
  });

  test("analysis page loads dashboard from REST without WS", async ({ page }) => {
    await goToProject(page, "p-1");
    await page.getByText("정적 분석").click();
    await waitForContent(page);
    // Dashboard should render from REST data, not dependent on WS
    await expect(page.locator(".static-dashboard, .analysis-dashboard")).toBeVisible();
  });
});

test.describe("WS Recovery — Pipeline Re-entry", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
    await mockApi.on("GET", "/pipeline/status", {
      success: true,
      data: {
        isRunning: false,
        targets: [{ id: "t-1", name: "main", status: "ready", phase: "ready", message: "" }],
        readyCount: 1,
        failedCount: 0,
        totalCount: 1,
      },
    });
  });

  test("build targets section loads from REST without WS", async ({ page }) => {
    await goToProject(page, "p-1");
    await page.getByText("정적 분석").click();
    await waitForContent(page);
    // Build target section should be visible from REST data
    await expect(page.locator(".gs-card")).toBeVisible();
  });
});
