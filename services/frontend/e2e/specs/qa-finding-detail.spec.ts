/**
 * QA BUG-1 regression test: Finding detail view should not crash.
 */
import { test, expect } from "../fixtures/base";
import { goToProject, waitForContent } from "../helpers/navigation";

test("Finding card click navigates to detail without error", async ({ page, mockApi }) => {
  await mockApi.setupProject("p-1");
  await goToProject(page, "p-1", "static-analysis");
  await waitForContent(page);

  // Finding cards use .vuln-card class in LatestAnalysisTab
  const findingCard = page.locator(".vuln-card").first();
  await expect(findingCard).toBeVisible({ timeout: 5000 });
  await findingCard.click();
  await waitForContent(page);

  // Should NOT show error boundary
  await expect(page.locator(".error-boundary__content")).not.toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: "e2e/qa-captures/finding-detail-fixed.png", fullPage: true });
});
