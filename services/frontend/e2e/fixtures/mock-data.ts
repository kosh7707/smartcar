/**
 * Centralized mock data for Playwright E2E tests.
 * All data matches @aegis/shared types and uses Korean labels.
 */

// ── Projects ──

export const PROJECTS = [
  {
    id: "p-1",
    name: "차량 게이트웨이 ECU",
    description: "차량용 게이트웨이 ECU 보안 분석 프로젝트",
    createdAt: "2026-03-01T09:00:00Z",
    updatedAt: "2026-03-27T14:30:00Z",
  },
  {
    id: "p-2",
    name: "바디 컨트롤 모듈",
    description: "BCM 펌웨어 보안 검증",
    createdAt: "2026-03-10T09:00:00Z",
    updatedAt: "2026-03-25T11:00:00Z",
  },
];

// ── Files ──

export const FILES = [
  { id: "f-1", name: "main.c", size: 15420, language: "c", projectId: "p-1", path: "src/main.c", createdAt: "2026-03-15T10:00:00Z" },
  { id: "f-2", name: "gateway.c", size: 28300, language: "c", projectId: "p-1", path: "src/gateway.c", createdAt: "2026-03-15T10:00:00Z" },
  { id: "f-3", name: "can_handler.h", size: 4200, language: "c", projectId: "p-1", path: "include/can_handler.h", createdAt: "2026-03-15T10:00:00Z" },
  { id: "f-4", name: "auth.c", size: 9800, language: "c", projectId: "p-1", path: "src/auth.c", createdAt: "2026-03-15T10:00:00Z" },
  { id: "f-5", name: "crypto_utils.c", size: 12500, language: "c", projectId: "p-1", path: "src/crypto_utils.c", createdAt: "2026-03-15T10:00:00Z" },
];

// ── Findings ──

export const FINDINGS = [
  {
    id: "find-1", runId: "run-1", projectId: "p-1", module: "static_analysis",
    status: "open", severity: "critical", confidence: "high", sourceType: "agent",
    title: "버퍼 오버플로우 - CAN 메시지 처리",
    description: "CAN 메시지 파싱 시 입력 길이를 검증하지 않아 스택 버퍼 오버플로우 발생 가능",
    location: "src/can_handler.c:142", suggestion: "입력 길이 검증 추가",
    fingerprint: "a1b2c3d4e5f60001",
    createdAt: "2026-03-25T10:00:00Z", updatedAt: "2026-03-25T10:00:00Z",
  },
  {
    id: "find-2", runId: "run-1", projectId: "p-1", module: "static_analysis",
    status: "needs_review", severity: "high", confidence: "medium", sourceType: "sast-tool",
    title: "하드코딩된 인증키",
    description: "소스 코드에 인증키가 하드코딩되어 있습니다",
    location: "src/auth.c:55", ruleId: "CWE-798", suggestion: "환경 변수 또는 키 저장소 사용",
    fingerprint: "a1b2c3d4e5f60002",
    createdAt: "2026-03-25T10:01:00Z", updatedAt: "2026-03-25T10:01:00Z",
  },
  {
    id: "find-3", runId: "run-1", projectId: "p-1", module: "static_analysis",
    status: "open", severity: "medium", confidence: "high", sourceType: "rule-engine",
    title: "안전하지 않은 메모리 할당",
    description: "malloc 반환값 검증 없이 사용",
    location: "src/gateway.c:88", ruleId: "CWE-252",
    fingerprint: "a1b2c3d4e5f60003",
    createdAt: "2026-03-25T10:02:00Z", updatedAt: "2026-03-25T10:02:00Z",
  },
  {
    id: "find-4", runId: "run-1", projectId: "p-1", module: "deep_analysis",
    status: "sandbox", severity: "high", confidence: "low", sourceType: "llm-assist",
    title: "경쟁 조건 가능성 - 타이머 핸들러",
    description: "인터럽트 핸들러에서 공유 변수를 비원자적으로 접근",
    location: "src/main.c:203",
    fingerprint: "a1b2c3d4e5f60004",
    createdAt: "2026-03-26T09:00:00Z", updatedAt: "2026-03-26T09:00:00Z",
  },
  {
    id: "find-5", runId: "run-2", projectId: "p-1", module: "static_analysis",
    status: "fixed", severity: "low", confidence: "high", sourceType: "sast-tool",
    title: "미사용 변수",
    description: "선언된 변수가 사용되지 않습니다",
    location: "src/crypto_utils.c:22", ruleId: "CWE-561",
    fingerprint: "a1b2c3d4e5f60005",
    createdAt: "2026-03-24T08:00:00Z", updatedAt: "2026-03-26T12:00:00Z",
  },
];

// ── Runs ──

export const RUNS = [
  {
    id: "run-1", projectId: "p-1", module: "static_analysis",
    status: "completed", analysisResultId: "ar-1", findingCount: 4,
    startedAt: "2026-03-25T09:55:00Z", endedAt: "2026-03-25T10:02:30Z",
    createdAt: "2026-03-25T09:55:00Z",
  },
  {
    id: "run-2", projectId: "p-1", module: "static_analysis",
    status: "completed", analysisResultId: "ar-2", findingCount: 1,
    startedAt: "2026-03-24T07:55:00Z", endedAt: "2026-03-24T08:01:00Z",
    createdAt: "2026-03-24T07:55:00Z",
  },
];

// ── Build Targets ──

export const TARGETS = [
  {
    id: "t-1", projectId: "p-1", name: "gateway-main",
    relativePath: "gateway/", includedPaths: ["src/", "include/"],
    buildProfile: { sdkId: "none", compiler: "arm-none-eabi-gcc", targetArch: "arm", languageStandard: "c11", headerLanguage: "c" as const },
    status: "ready", createdAt: "2026-03-20T10:00:00Z", updatedAt: "2026-03-25T10:00:00Z",
  },
  {
    id: "t-2", projectId: "p-1", name: "crypto-lib",
    relativePath: "crypto/", includedPaths: ["src/crypto_utils.c"],
    buildProfile: { sdkId: "none", compiler: "arm-none-eabi-gcc", targetArch: "arm", languageStandard: "c11", headerLanguage: "c" as const },
    status: "building", createdAt: "2026-03-20T10:00:00Z", updatedAt: "2026-03-27T09:00:00Z",
  },
];

// ── Quality Gates ──

export const GATES = [
  {
    id: "gate-1", runId: "run-1", projectId: "p-1", status: "fail",
    rules: [
      { ruleId: "no-critical", result: "failed", message: "Critical 취약점 1건 존재", linkedFindingIds: ["find-1"] },
      { ruleId: "high-threshold", result: "warning", message: "High 취약점 2건 (임계값: 3)", linkedFindingIds: ["find-2", "find-4"] },
      { ruleId: "evidence-coverage", result: "passed", message: "증적 커버리지 85%", linkedFindingIds: [] },
      { ruleId: "sandbox-unreviewed", result: "failed", message: "미검토 Sandbox Finding 1건", linkedFindingIds: ["find-4"] },
    ],
    evaluatedAt: "2026-03-25T10:03:00Z", createdAt: "2026-03-25T10:03:00Z",
  },
];

// ── Approvals ──

export const APPROVALS = [
  {
    id: "appr-1", actionType: "gate.override", requestedBy: "analyst",
    targetId: "gate-1", projectId: "p-1",
    reason: "긴급 릴리스 대응 — Critical 취약점은 핫픽스 예정",
    status: "pending", expiresAt: "2026-04-01T00:00:00Z",
    createdAt: "2026-03-25T11:00:00Z",
  },
  {
    id: "appr-2", actionType: "finding.accepted_risk", requestedBy: "analyst",
    targetId: "find-2", projectId: "p-1",
    reason: "테스트 환경 전용 키 — 프로덕션에서는 별도 키 관리 시스템 사용",
    status: "approved",
    decision: { decidedBy: "lead", decidedAt: "2026-03-26T09:00:00Z", comment: "확인 완료" },
    expiresAt: "2026-04-01T00:00:00Z",
    createdAt: "2026-03-25T12:00:00Z",
  },
];

// ── Activities ──

export const ACTIVITIES = [
  { type: "run_completed", timestamp: "2026-03-25T10:02:30Z", summary: "정적 분석 완료 (Finding 4건)", metadata: { runId: "run-1" } },
  { type: "finding_status_changed", timestamp: "2026-03-26T12:00:00Z", summary: "미사용 변수 → Fixed", metadata: { findingId: "find-5" } },
  { type: "approval_decided", timestamp: "2026-03-26T09:00:00Z", summary: "하드코딩 키 위험 수용 승인", metadata: { approvalId: "appr-2" } },
];

// ── Overview ──

/** Pattern A: fetchProjectOverview returns apiFetch result directly (no .data extraction) */
export function projectOverview(projectId: string) {
  return {
    project: PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0],
    fileCount: FILES.length,
    summary: {
      totalVulnerabilities: FINDINGS.length,
      bySeverity: { total: 5, critical: 1, high: 2, medium: 1, low: 1, info: 0 },
      byModule: { static: 4, dynamic: 0, test: 0 },
    },
    targetSummary: { total: 2, ready: 1, failed: 0, running: 1, discovered: 0 },
    recentAnalyses: ANALYSIS_RESULTS,
  };
}

// ── Dashboard Summary ──

export const DASHBOARD_SUMMARY = {
  success: true,
  data: {
    bySeverity: { critical: 1, high: 2, medium: 1, low: 1, info: 0 },
    byStatus: { open: 2, needs_review: 1, sandbox: 1, fixed: 1 },
    bySource: { agent: 1, "sast-tool": 2, "rule-engine": 1, "llm-assist": 1 },
    topFiles: [
      { filePath: "src/can_handler.c", findingCount: 1, topSeverity: "critical" },
      { filePath: "src/auth.c", findingCount: 1, topSeverity: "high" },
    ],
    topRules: [
      { ruleId: "CWE-798", hitCount: 1 },
      { ruleId: "CWE-252", hitCount: 1 },
    ],
    trend: [
      { date: "2026-03-24", runCount: 1, findingCount: 1, gatePassCount: 1 },
      { date: "2026-03-25", runCount: 1, findingCount: 4, gatePassCount: 0 },
    ],
    gateStats: { total: 1, passed: 0, failed: 1, rate: 0 },
    unresolvedCount: { open: 2, needsReview: 1, needsRevalidation: 0, sandbox: 1 },
  },
};

// ── Source File Entries (SourceFileEntry shape for FilesPage) ──

export const SOURCE_FILE_ENTRIES = [
  { relativePath: "src/main.c", size: 15420, language: "c", fileType: "source" as const, previewable: true },
  { relativePath: "src/gateway.c", size: 28300, language: "c", fileType: "source" as const, previewable: true },
  { relativePath: "include/can_handler.h", size: 4200, language: "c", fileType: "source" as const, previewable: true },
  { relativePath: "src/auth.c", size: 9800, language: "c", fileType: "source" as const, previewable: true },
  { relativePath: "src/crypto_utils.c", size: 12500, language: "c", fileType: "source" as const, previewable: true },
];

/** Pattern A: fetchSourceFilesWithComposition returns apiFetch result directly */
export const SOURCE_FILES_RESPONSE = {
  success: true,
  data: SOURCE_FILE_ENTRIES,
  composition: { c: { count: 5, bytes: 70220 } },
  totalFiles: 5,
  totalSize: 70220,
  targetMapping: {
    "src/main.c": { targetId: "t-1", targetName: "gateway-main" },
    "src/gateway.c": { targetId: "t-1", targetName: "gateway-main" },
    "include/can_handler.h": { targetId: "t-1", targetName: "gateway-main" },
    "src/crypto_utils.c": { targetId: "t-2", targetName: "crypto-lib" },
  },
};

// ── Vulnerabilities (for VulnerabilitiesPage via AnalysisResult) ──

export const VULNERABILITIES = [
  { id: "vuln-1", severity: "critical" as const, title: "버퍼 오버플로우 - CAN 메시지 처리",
    description: "CAN 메시지 파싱 시 입력 길이를 검증하지 않아 스택 버퍼 오버플로우 발생 가능",
    location: "src/can_handler.c:142", source: "rule" as const, ruleId: "CWE-120" },
  { id: "vuln-2", severity: "high" as const, title: "하드코딩된 인증키",
    description: "소스 코드에 인증키가 하드코딩되어 있습니다",
    location: "src/auth.c:55", source: "rule" as const, ruleId: "CWE-798" },
  { id: "vuln-3", severity: "medium" as const, title: "안전하지 않은 메모리 할당",
    description: "malloc 반환값 검증 없이 사용",
    location: "src/gateway.c:88", source: "rule" as const, ruleId: "CWE-252" },
  { id: "vuln-4", severity: "low" as const, title: "미사용 변수",
    description: "선언된 변수가 사용되지 않습니다",
    location: "src/crypto_utils.c:22", source: "rule" as const, ruleId: "CWE-561" },
];

export const ANALYSIS_RESULTS = [{
  id: "ar-1", projectId: "p-1", module: "static_analysis" as const, status: "completed" as const,
  vulnerabilities: VULNERABILITIES,
  summary: { total: 4, critical: 1, high: 1, medium: 1, low: 1, info: 0 },
  createdAt: "2026-03-25T10:00:00Z",
}];

// ── Report ──

export const PROJECT_REPORT = {
  success: true,
  data: {
    generatedAt: "2026-03-27T15:00:00Z",
    projectId: "p-1",
    projectName: "차량 게이트웨이 ECU",
    modules: {
      static: {
        meta: { generatedAt: "2026-03-27T15:00:00Z", projectId: "p-1", projectName: "차량 게이트웨이 ECU", module: "static_analysis" },
        summary: {
          totalFindings: 4, bySeverity: { critical: 1, high: 1, medium: 1, low: 1 },
          byStatus: { open: 2, needs_review: 1, fixed: 1 }, bySource: { agent: 1, "sast-tool": 2, "rule-engine": 1 },
        },
        runs: [{ run: RUNS[0] }],
        findings: FINDINGS.filter((f) => f.module === "static_analysis").map((f) => ({ finding: f, evidenceRefs: [] })),
        gateResults: GATES,
      },
    },
    totalSummary: {
      totalFindings: 5, bySeverity: { critical: 1, high: 2, medium: 1, low: 1 },
      byStatus: { open: 2, needs_review: 1, sandbox: 1, fixed: 1 }, bySource: { agent: 1, "sast-tool": 2, "rule-engine": 1, "llm-assist": 1 },
    },
    approvals: APPROVALS,
    auditTrail: [],
  },
};

// ── Health ──

export const HEALTH_OK = {
  service: "aegis-backend",
  status: "ok",
  version: "0.7.0",
  detail: { version: "0.7.0", uptime: 3661 },
};

// ── Analysis Status (active analyses) ──

export const ANALYSIS_STATUS_EMPTY = { success: true, data: [] };

// ── Approvals Count ──

export const APPROVAL_COUNT = { success: true, data: { pending: 1, total: 2 } };
