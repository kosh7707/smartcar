/**
 * Responsive layout tests.
 * Verifies layout adapts correctly at key breakpoints.
 */
import { test, expect } from "../fixtures/base";
import { goToProject, waitForContent } from "../helpers/navigation";

test.describe("Responsive Layout", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
  });

  test("overview at 768px — single column", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("responsive-overview-768.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("overview at 1024px — two column", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("responsive-overview-1024.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("overview at 480px — compact", async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("responsive-overview-480.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("static analysis at 768px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("responsive-static-768.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("files page at 768px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await goToProject(page, "p-1", "files");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("responsive-files-768.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
