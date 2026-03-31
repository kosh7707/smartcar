/**
 * QA verification of S1's WR response claims.
 * Tests: UX-2 bulk triage, UX-3 approval dialog, Finding detail components
 */
import { test, expect } from "../fixtures/base";
import { goToProject, waitForContent } from "../helpers/navigation";

const D = "e2e/qa-captures/verify";

async function cap(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: `${D}/${name}.png`, fullPage: true, animations: "disabled" });
}

test.describe("S1 Response Verification", () => {
  // UX-2: S1 claims bulk triage exists in LatestAnalysisTab
  test("UX-2: check bulk triage in static analysis latest tab", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    // Scroll down to finding list area
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await cap(page, "ux2-static-analysis-finding-list");

    // Check for checkboxes
    const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
    const checkboxCount = await checkboxes.count();
    await cap(page, `ux2-checkboxes-found-${checkboxCount}`);
  });

  // UX-3: S1 claims approval dialog works — filter tab vs action button
  test("UX-3: approval action button vs filter tab", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    // Mock approval action
    await mockApi.on("POST", "/api/approvals/appr-1", { success: true });

    await goToProject(page, "p-1", "approvals");
    await waitForContent(page);

    // Capture initial state (showing "대기" tab with pending item)
    await cap(page, "ux3-approvals-initial");

    // S1 says: use .approval-card button.btn-sm, not the filter tab
    // Try clicking the small action button INSIDE a card, not the filter tab
    const actionBtn = page.locator('.approval-card button, .card button').filter({ hasText: /승인/ }).first();
    const filterBtn = page.locator('.approval-filter__btn, [class*="filter"] button').filter({ hasText: /승인/ }).first();

    // Log what we find
    const actionCount = await actionBtn.count();
    const filterCount = await filterBtn.count();

    // Try clicking "대기" tab first to see pending items
    const pendingTab = page.locator('button').filter({ hasText: /대기/ });
    if (await pendingTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pendingTab.click();
      await waitForContent(page);
      await cap(page, "ux3-pending-tab");
    }

    // Now try to find and click the approve button inside the pending card
    // The button should be inside the card content, not the filter bar
    const cardApproveBtn = page.locator('button').filter({ hasText: /승인/ });
    const allButtons = await cardApproveBtn.all();

    // Capture with button count annotation
    await cap(page, `ux3-approve-buttons-found-${allButtons.length}`);

    // Click the LAST approve button (more likely to be the card action, not filter)
    if (allButtons.length > 1) {
      await allButtons[allButtons.length - 1].click();
      await page.waitForTimeout(500);
      await cap(page, "ux3-after-card-approve-click");
    } else if (allButtons.length === 1) {
      // Only one — might be filter tab
      await allButtons[0].click();
      await page.waitForTimeout(500);
      await cap(page, "ux3-after-single-approve-click");
    }
  });

  // Finding detail component verification
  test("Finding detail: verify all rendered components", async ({ page, mockApi }) => {
    await mockApi.setupProject("p-1");
    await goToProject(page, "p-1", "static-analysis");
    await waitForContent(page);

    // Click finding using correct selector
    const card = page.locator(".vuln-card").first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();
    await waitForContent(page);

    // Full page capture
    await cap(page, "finding-detail-full");

    // Scroll to bottom to capture all sections
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await cap(page, "finding-detail-bottom");
  });
});
