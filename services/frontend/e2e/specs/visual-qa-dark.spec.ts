/**
 * Visual QA — Dark theme screenshots.
 * Captures dark mode renders of all major pages for visual review.
 */
import { test, expect } from "../fixtures/base";
import { navigateTo, goToProject, waitForContent } from "../helpers/navigation";

test.describe("Visual QA — Dark Theme", () => {
  test.beforeEach(async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    // Set dark theme before any page loads
    await page.addInitScript(() => {
      localStorage.setItem("aegis:theme", "dark");
    });
  });

  test("overview — dark", async ({ page }) => {
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("dark-overview.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("static analysis — dark", async ({ page }) => {
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("dark-static-analysis.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("files page — dark", async ({ page }) => {
    await goToProject(page, "p-1", "files");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("dark-files.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("vulnerabilities — dark", async ({ page }) => {
    await goToProject(page, "p-1", "vulnerabilities");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("dark-vulnerabilities.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("quality gate — dark", async ({ page }) => {
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("dark-quality-gate.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("approvals — dark", async ({ page }) => {
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("dark-approvals.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
