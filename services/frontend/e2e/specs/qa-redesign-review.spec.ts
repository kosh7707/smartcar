import { test } from "../fixtures/base";
import { goToProject, waitForContent } from "../helpers/navigation";

const CAPTURE_DIR = "e2e/qa-captures/redesign";

const pages = [
  { name: "projects", path: "/projects" },
  { name: "overview", sub: "overview" },
  { name: "static-analysis", sub: "static-analysis" },
  { name: "vulnerabilities", sub: "vulnerabilities" },
  { name: "files", sub: "files" },
  { name: "analysis-history", sub: "analysis-history" },
  { name: "report", sub: "report" },
  { name: "quality-gate", sub: "quality-gate" },
  { name: "approvals", sub: "approvals" },
  { name: "settings-project", sub: "settings" },
  { name: "settings-global", path: "/settings" },
];

for (const pg of pages) {
  test(`QA Redesign — ${pg.name} (light)`, async ({ page, mockApi }) => {
    await mockApi.setupProjectsList();
    await mockApi.setupProject("p-1");

    if (pg.path) {
      await page.goto(`/#${pg.path}`);
    } else {
      await goToProject(page, "p-1", pg.sub!);
    }
    await waitForContent(page);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${CAPTURE_DIR}/${pg.name}-light.png`,
      fullPage: true,
    });
  });

  test(`QA Redesign — ${pg.name} (dark)`, async ({ page, mockApi }) => {
    await page.addInitScript(() => {
      localStorage.setItem("aegis:theme", "dark");
    });
    await mockApi.setupProjectsList();
    await mockApi.setupProject("p-1");

    if (pg.path) {
      await page.goto(`/#${pg.path}`);
    } else {
      await goToProject(page, "p-1", pg.sub!);
    }
    await waitForContent(page);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${CAPTURE_DIR}/${pg.name}-dark.png`,
      fullPage: true,
    });
  });
}
