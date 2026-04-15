#!/usr/bin/env node
/**
 * Wave 1 reviewer UI verification.
 *
 * Verifies the CSS-purge implementation wave against the reviewer lane contract:
 * - capture screenshots for touched routes on localhost:5173
 * - run targeted DOM checks for exactly one semantic h1
 * - exercise Files and Static Analysis leaf dialogs affected by wave 1
 * - write a machine-readable JSON report plus screenshots under artifacts/
 *
 * Usage from repo root:
 *   node artifacts/s1-shadcn-team-discovery/wave1-reviewer/verify-wave1-ui.mjs
 *   node artifacts/s1-shadcn-team-discovery/wave1-reviewer/verify-wave1-ui.mjs --base-url=http://localhost:5173 --headed
 *
 * By default, the script reuses localhost:5173 if it is already responding. If not,
 * it starts `npm run dev:mock -- --host 127.0.0.1` in services/frontend so the UI can
 * be inspected without a backend. API requests are also mocked at the browser route
 * layer to keep the check deterministic when an existing Vite server is reused.
 */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const frontendDir = path.join(repoRoot, "services/frontend");
const requireFromFrontend = createRequire(path.join(frontendDir, "package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length > 0 ? rest.join("=") : "true"];
  }),
);

const baseUrl = args.get("base-url") ?? "http://localhost:5173";
const headed = args.get("headed") === "true";
const noStartServer = args.get("no-start-server") === "true";
const outDir = path.resolve(
  repoRoot,
  args.get("out") ?? "artifacts/s1-shadcn-team-discovery/wave1-reviewer/latest",
);
const screenshotDir = path.join(outDir, "screenshots");

const nowIso = new Date().toISOString();
const projectId = "p-1";
const authUser = {
  id: "reviewer-worker-4",
  username: "worker-4",
  displayName: "Wave 1 Reviewer",
  role: "admin",
  createdAt: nowIso,
  updatedAt: nowIso,
};

const project = {
  id: projectId,
  name: "차량 게이트웨이 ECU",
  description: "차량용 게이트웨이 ECU 보안 분석 프로젝트",
  createdAt: "2026-03-01T09:00:00Z",
  updatedAt: "2026-03-27T14:30:00Z",
  lastAnalysisAt: "2026-03-25T10:02:30Z",
  severitySummary: { critical: 1, high: 2, medium: 1, low: 1, info: 0 },
  gateStatus: "fail",
  unresolvedDelta: 2,
};

const files = [
  { id: "f-1", name: "main.c", size: 15420, language: "c", projectId, path: "src/main.c", relativePath: "src/main.c", createdAt: "2026-03-15T10:00:00Z" },
  { id: "f-2", name: "gateway.c", size: 28300, language: "c", projectId, path: "src/gateway.c", relativePath: "src/gateway.c", createdAt: "2026-03-15T10:00:00Z" },
  { id: "f-3", name: "can_handler.h", size: 4200, language: "c", projectId, path: "include/can_handler.h", relativePath: "include/can_handler.h", createdAt: "2026-03-15T10:00:00Z" },
];

const targets = [
  {
    id: "t-1",
    projectId,
    name: "gateway-main",
    relativePath: "gateway/",
    includedPaths: ["src/", "include/"],
    buildProfile: { sdkId: "none", compiler: "arm-none-eabi-gcc", targetArch: "arm", languageStandard: "c11", headerLanguage: "c" },
    status: "ready",
    phase: "ready",
    createdAt: "2026-03-20T10:00:00Z",
    updatedAt: "2026-03-25T10:00:00Z",
  },
  {
    id: "t-2",
    projectId,
    name: "crypto-lib",
    relativePath: "crypto/",
    includedPaths: ["src/crypto_utils.c"],
    buildProfile: { sdkId: "none", compiler: "arm-none-eabi-gcc", targetArch: "arm", languageStandard: "c11", headerLanguage: "c" },
    status: "building",
    phase: "build",
    createdAt: "2026-03-20T10:00:00Z",
    updatedAt: "2026-03-27T09:00:00Z",
  },
];

const findings = [
  { id: "find-1", runId: "run-1", projectId, module: "static_analysis", status: "open", severity: "critical", confidence: "high", sourceType: "agent", title: "버퍼 오버플로우 - CAN 메시지 처리", description: "CAN 메시지 파싱 시 입력 길이 검증 누락", location: "src/can_handler.c:142", fingerprint: "f1", createdAt: nowIso, updatedAt: nowIso },
  { id: "find-2", runId: "run-1", projectId, module: "static_analysis", status: "needs_review", severity: "high", confidence: "medium", sourceType: "sast-tool", title: "하드코딩된 인증키", description: "소스 코드에 인증키가 하드코딩됨", location: "src/auth.c:55", fingerprint: "f2", createdAt: nowIso, updatedAt: nowIso },
];

const runs = [
  { id: "run-1", projectId, module: "static_analysis", status: "completed", analysisResultId: "ar-1", findingCount: 2, startedAt: "2026-03-25T09:55:00Z", endedAt: "2026-03-25T10:02:30Z", createdAt: "2026-03-25T09:55:00Z" },
];

const gate = {
  id: "gate-1",
  runId: "run-1",
  projectId,
  status: "fail",
  evaluatedAt: nowIso,
  createdAt: nowIso,
  rules: [
    { ruleId: "no-critical", result: "failed", message: "Critical 취약점 1건 존재", linkedFindingIds: ["find-1"] },
    { ruleId: "evidence-coverage", result: "passed", message: "증적 커버리지 85%", linkedFindingIds: [] },
  ],
};

const dashboardSummary = {
  success: true,
  data: {
    bySeverity: { critical: 1, high: 1, medium: 0, low: 0, info: 0 },
    byStatus: { open: 1, needs_review: 1, sandbox: 0, fixed: 0 },
    bySource: { agent: 1, "sast-tool": 1 },
    topFiles: [{ filePath: "src/can_handler.c", findingCount: 1, topSeverity: "critical" }],
    topRules: [{ ruleId: "CWE-120", hitCount: 1 }],
    trend: [{ date: "2026-03-25", runCount: 1, findingCount: 2, gatePassCount: 0 }],
    gateStats: { total: 1, passed: 0, failed: 1, rate: 0 },
    recentRuns: runs,
    latestRun: runs[0],
  },
};

const json = (data, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(data) });

function mockResponseFor(url, method) {
  const pathname = url.pathname;
  if (pathname === "/health") return json({ status: "ok", service: "aegis-frontend-review" });
  if (pathname === "/api/auth/me") return json({ success: true, data: authUser });
  if (pathname === "/api/auth/users") return json({ success: true, data: [authUser] });
  if (pathname === "/api/auth/logout") return json({ success: true });
  if (pathname === "/api/analysis/status") return json({ success: true, data: null });
  if (pathname === "/api/analysis/summary") return json(dashboardSummary);
  if (pathname === "/api/gate-profiles") return json({ success: true, data: [] });
  if (pathname === "/api/projects" && method === "GET") return json({ success: true, data: [project] });
  if (pathname === "/api/runs/run-1") return json({ success: true, data: { run: runs[0], gate, findings: findings.map((finding) => ({ finding, evidenceRefs: [] })) } });
  if (pathname.startsWith("/api/findings/")) return json({ success: true, data: { ...findings[0], evidenceRefs: [], auditLog: [] } });

  const projectPrefix = `/api/projects/${projectId}`;
  if (pathname.startsWith(projectPrefix)) {
    const sub = pathname.slice(projectPrefix.length);
    if (sub === "/overview") return json({ project, fileCount: files.length, summary: { totalVulnerabilities: findings.length, bySeverity: dashboardSummary.data.bySeverity, byModule: { static: findings.length, dynamic: 0, test: 0 } }, targetSummary: { total: targets.length, ready: 1, failed: 0, running: 1, discovered: 0 }, recentAnalyses: runs, trend: { newFindings: 2, resolvedFindings: 0, unresolvedTotal: 2 } });
    if (sub === "/source/files") return json({ success: true, data: files, composition: { source: { count: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0) } }, totalFiles: files.length, totalSize: files.reduce((sum, file) => sum + file.size, 0), targetMapping: {} });
    if (sub.startsWith("/source/file")) return json({ success: true, data: { path: "src/main.c", content: "int main(void) { return 0; }\n", language: "c", size: 29, lineCount: 1, previewable: true } });
    if (sub === "/files") return json({ success: true, data: files });
    if (sub === "/targets") return json({ success: true, data: targets });
    if (sub === "/targets/discover" && method === "POST") return json({ success: true, data: { discovered: targets.length, created: 0, targets, elapsedMs: 32 } });
    if (sub === "/targets/t-1/build-log") return json({ success: true, data: { buildLog: "[100%] Built target gateway-main\nSAST scan complete\n", status: "ready", updatedAt: nowIso } });
    if (sub === "/targets/t-2/build-log") return json({ success: true, data: { buildLog: null, status: "building", updatedAt: nowIso } });
    if (sub.match(/^\/targets\/[^/]+\/libraries/)) return json({ success: true, data: [] });
    if (sub === "/pipeline/status") return json({ success: true, data: { targets, readyCount: 1, failedCount: 0, totalCount: targets.length } });
    if (sub.startsWith("/pipeline/run")) return json({ success: true, data: { pipelineId: "review-pipeline", status: "running" } });
    if (sub === "/findings") return json({ success: true, data: findings });
    if (sub === "/findings/groups") return json({ success: true, data: [] });
    if (sub === "/runs") return json({ success: true, data: runs });
    if (sub === "/gates") return json({ success: true, data: [gate] });
    if (sub === "/approvals") return json({ success: true, data: [] });
    if (sub === "/approvals/count") return json({ success: true, data: { pending: 0 } });
    if (sub.startsWith("/activity")) return json({ success: true, data: [] });
    if (sub === "/sdk") return json({ success: true, data: { builtIn: [], registered: [] } });
    if (sub === "/settings") return json({ success: true, data: { llmUrl: "http://localhost:8080", gateProfileId: "gp-default" } });
    if (sub === "/notifications") return json({ success: true, data: [] });
    if (sub === "/notifications/count") return json({ success: true, data: { unread: 0 } });
    if (method === "DELETE") return json({ success: true });
  }

  return json({ success: true, data: [] });
}

function requestOk(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await requestOk(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureServer() {
  if (await requestOk(baseUrl)) return { server: null, reused: true };
  if (noStartServer) throw new Error(`${baseUrl} is not responding and --no-start-server was supplied`);

  const server = spawn("npm", ["run", "dev:mock", "--", "--host", "127.0.0.1"], {
    cwd: frontendDir,
    env: { ...process.env, VITE_MOCK: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = [];
  server.stdout.on("data", (chunk) => log.push(chunk.toString()));
  server.stderr.on("data", (chunk) => log.push(chunk.toString()));

  if (!(await waitForServer(baseUrl))) {
    server.kill("SIGTERM");
    throw new Error(`Timed out waiting for ${baseUrl}. Vite output:\n${log.join("")}`);
  }
  return { server, reused: false };
}

async function dismissKnownOverlays(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator('[role="dialog"], .confirm-overlay, .build-log-overlay').first().waitFor({ state: "hidden", timeout: 800 }).catch(() => {});
}

async function collectDom(page, name, expectedH1) {
  const dom = await page.evaluate(() => {
    const main = document.querySelector(".layout-project__main") ?? document.querySelector("main") ?? document.body;
    const text = (element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const h1s = [...main.querySelectorAll("h1")].map(text).filter(Boolean);
    const legacyTokens = ["btn", "btn-icon", "card", "form-input"];
    const legacyControls = {};
    for (const token of legacyTokens) {
      legacyControls[token] = [...main.querySelectorAll(`button.${token}, input.${token}, textarea.${token}, select.${token}, [role="dialog"].${token}, .confirm-overlay .${token}, .build-log-overlay .${token}`)]
        .map((element) => ({ tag: element.tagName.toLowerCase(), text: text(element).slice(0, 80), title: element.getAttribute("title") ?? "" }));
    }
    return {
      h1s,
      legacyControls,
      dialogs: [...document.querySelectorAll('[role="dialog"], .confirm-overlay, .build-log-overlay')].map((element) => ({ role: element.getAttribute("role"), className: element.getAttribute("class"), text: text(element).slice(0, 120) })),
    };
  });

  const failures = [];
  if (dom.h1s.length !== 1) failures.push(`${name}: expected exactly one h1, found ${dom.h1s.length} (${dom.h1s.join(" | ")})`);
  if (expectedH1 && dom.h1s[0] !== expectedH1) failures.push(`${name}: expected h1 ${JSON.stringify(expectedH1)}, found ${JSON.stringify(dom.h1s[0] ?? "")}`);
  return { ...dom, failures };
}

async function capture(page, name) {
  const target = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true, animations: "disabled" });
  return path.relative(repoRoot, target);
}

async function navigate(page, routePath) {
  await page.goto(new URL(routePath, baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForSelector(".centered-loader", { state: "hidden", timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const serverState = await ensureServer();
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  await context.addInitScript((user) => {
    localStorage.setItem("aegis:authToken", "mock-token:worker-4-review");
    localStorage.setItem("aegis:mockUser", JSON.stringify(user));
    localStorage.removeItem("aegis:backendUrl");
  }, authUser);

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", async (route, request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      await route.fulfill(mockResponseFor(url, request.method()));
      return;
    }
    await route.continue();
  });

  const routeChecks = [
    { name: "files", path: `/projects/${projectId}/files`, expectedH1: "파일 탐색기" },
    { name: "static-analysis", path: `/projects/${projectId}/static-analysis`, expectedH1: "정적 분석" },
    { name: "overview", path: `/projects/${projectId}/overview`, expectedH1: project.name },
    { name: "global-settings", path: "/settings", expectedH1: "시스템 설정" },
  ];

  const results = [];
  const failures = [];

  for (const routeCheck of routeChecks) {
    await navigate(page, routeCheck.path);
    const screenshot = await capture(page, routeCheck.name);
    const dom = await collectDom(page, routeCheck.name, routeCheck.expectedH1);
    failures.push(...dom.failures);
    results.push({ ...routeCheck, screenshot, dom });
  }

  await navigate(page, `/projects/${projectId}/files`);
  const filesInteractions = [];
  const createTargetButton = page.getByRole("button", { name: /빌드 타겟 생성/ }).first();
  if (await createTargetButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await createTargetButton.click();
    await page.getByText(/BuildTarget 생성|빌드 타겟 생성/).first().waitFor({ timeout: 3_000 });
    const screenshot = await capture(page, "files-build-target-dialog");
    const dialogRoleCount = await page.locator('[role="dialog"]').count();
    if (dialogRoleCount < 1) failures.push("files-build-target-dialog: expected shadcn/dialog-style [role=dialog] after opening create target dialog");
    filesInteractions.push({ name: "build-target-create-dialog", screenshot, dialogRoleCount });
    await dismissKnownOverlays(page);
  } else {
    failures.push("files: could not find 빌드 타겟 생성 button");
  }

  const logButton = page.getByRole("button", { name: /빌드 로그|로그/ }).first();
  if (await logButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await logButton.click();
    await page.getByText(/빌드 로그|Built target|로그 불러오는 중/).first().waitFor({ timeout: 3_000 });
    const screenshot = await capture(page, "files-build-log-viewer");
    const dialogRoleCount = await page.locator('[role="dialog"]').count();
    if (dialogRoleCount < 1) failures.push("files-build-log-viewer: expected shadcn/dialog-style [role=dialog] after opening build log viewer");
    filesInteractions.push({ name: "build-log-viewer", screenshot, dialogRoleCount });
    await dismissKnownOverlays(page);
  } else {
    failures.push("files: could not find build log button");
  }
  results.push({ name: "files-interactions", interactions: filesInteractions });

  await navigate(page, `/projects/${projectId}/static-analysis`);
  const staticInteractions = [];
  const newAnalysisButton = page.getByRole("button", { name: /새 분석|분석 실행/ }).first();
  if (await newAnalysisButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await newAnalysisButton.click();
    await page.getByText(/분석 대상 선택|소스 코드 업로드|분석 실행/).first().waitFor({ timeout: 3_000 });
    const screenshot = await capture(page, "static-analysis-target-selection");
    const targetDialogVisible = await page.getByText(/분석 대상 선택/).first().isVisible().catch(() => false);
    const dialogRoleCount = await page.locator('[role="dialog"]').count();
    if (targetDialogVisible && dialogRoleCount < 1) failures.push("static-analysis-target-selection: expected [role=dialog] for target select dialog");
    staticInteractions.push({ name: "target-select-or-upload-flow", screenshot, targetDialogVisible, dialogRoleCount });
    await dismissKnownOverlays(page);
  } else {
    failures.push("static-analysis: could not find 새 분석/분석 실행 button");
  }
  results.push({ name: "static-analysis-interactions", interactions: staticInteractions });

  const report = {
    generatedAt: nowIso,
    baseUrl,
    reusedExistingServer: serverState.reused,
    status: failures.length === 0 && pageErrors.length === 0 ? "PASS" : "FAIL",
    failures,
    pageErrors,
    consoleErrors: consoleErrors.slice(0, 20),
    results,
    note: "Screenshots require human visual review for spacing/density/readability. DOM gates are enforced above.",
  };

  const reportPath = path.join(outDir, "wave1-reviewer-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  await browser.close();
  if (serverState.server) serverState.server.kill("SIGTERM");

  console.log(JSON.stringify({ status: report.status, report: path.relative(repoRoot, reportPath), failures: report.failures }, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
