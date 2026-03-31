/**
 * Visual QA — screenshot-based regression tests.
 * Captures full-page screenshots of every major page for visual review.
 *
 * Usage:
 *   First run:  npx playwright test visual-qa --update-snapshots
 *   Later runs: npx playwright test visual-qa
 *   Review:     Read the screenshot files in e2e/__screenshots__/
 */
import { test, expect } from "../fixtures/base";
import { navigateTo, goToProject, waitForContent } from "../helpers/navigation";

test.describe("Visual QA — Global Pages", () => {
  test("projects list page", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/projects");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("projects-list.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("projects list — empty state", async ({ page, mockApi }) => {
    await mockApi.on("GET", "/api/projects", { success: true, data: [] });
    await navigateTo(page, "/projects");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("projects-list-empty.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("global settings page", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("settings-global.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});

test.describe("Visual QA — Project Pages", () => {
  test.beforeEach(async ({ mockApi }) => {
    await mockApi.setupProject("p-1");
  });

  test("overview dashboard", async ({ page }) => {
    await goToProject(page, "p-1", "overview");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("overview.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("static analysis page", async ({ page }) => {
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("static-analysis.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("files page", async ({ page }) => {
    await goToProject(page, "p-1", "files");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("files.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("vulnerabilities page", async ({ page }) => {
    await goToProject(page, "p-1", "vulnerabilities");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("vulnerabilities.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("analysis history page", async ({ page }) => {
    await goToProject(page, "p-1", "analysis-history");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("analysis-history.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("report page", async ({ page }) => {
    await goToProject(page, "p-1", "report");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("report.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("quality gate page", async ({ page }) => {
    await goToProject(page, "p-1", "quality-gate");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("quality-gate.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("approvals page", async ({ page }) => {
    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("approvals.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("project settings page", async ({ page }) => {
    await goToProject(page, "p-1", "settings");
    await waitForContent(page);

    await expect(page).toHaveScreenshot("project-settings.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
