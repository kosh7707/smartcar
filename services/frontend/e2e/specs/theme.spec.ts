/**
 * Theme Toggle tests.
 * Verifies light/dark/system theme switching and persistence.
 */
import { test, expect } from "../fixtures/base";
import { navigateTo, waitForContent } from "../helpers/navigation";

test.describe("Theme Toggle", () => {
  test("default theme resolves to light", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    // System default in headless Chromium resolves to light
    expect(theme === "light" || theme === null).toBeTruthy();
  });

  test("switching to dark theme", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);

    await page.getByText("다크", { exact: true }).click();

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    expect(theme).toBe("dark");

    const stored = await page.evaluate(() =>
      localStorage.getItem("aegis:theme"),
    );
    expect(stored).toBe("dark");

    await expect(page).toHaveScreenshot("theme-dark-settings.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("switching to light theme", async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await navigateTo(page, "/settings");
    await waitForContent(page);

    // First switch to dark, then back to light to verify toggle
    await page.getByText("다크", { exact: true }).click();
    await page.getByText("라이트", { exact: true }).click();

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    expect(theme).toBe("light");

    await expect(page).toHaveScreenshot("theme-light-settings.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("theme persists across navigation", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");

    // Set dark theme before navigation
    await page.addInitScript(() => {
      localStorage.setItem("aegis:theme", "dark");
    });

    await navigateTo(page, "/projects");
    await waitForContent(page);

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    expect(theme).toBe("dark");

    // Navigate to a different page
    await page.getByText("차량 게이트웨이 ECU").click();
    await waitForContent(page);

    const themeAfterNav = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    expect(themeAfterNav).toBe("dark");
  });
});
