/**
 * HashRouter navigation helpers for Playwright.
 */
import { Page } from "@playwright/test";

/** Navigate to a hash-routed path and wait for content to load. */
export async function navigateTo(page: Page, path: string) {
  await page.goto(`/#${path}`);
  await page.waitForLoadState("networkidle");
}

/** Navigate to a project sub-page. */
export async function goToProject(page: Page, projectId: string, sub = "overview") {
  await navigateTo(page, `/projects/${projectId}/${sub}`);
}

/** Wait for the main content area to have no spinners. */
export async function waitForContent(page: Page) {
  // Wait for any spinner to disappear
  await page.waitForSelector(".centered-loader", { state: "hidden", timeout: 5000 }).catch(() => {});
  // Small settle time for CSS transitions
  await page.waitForTimeout(200);
}
