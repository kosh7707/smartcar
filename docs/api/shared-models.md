# Shared (S1-S2) API / Model Contract

> Canonical contract for the current S1 (frontend) ↔ S2 (backend) integration.
>
> Authority order for this document:
> 1. `services/shared/src/models.ts`
> 2. `services/shared/src/dto.ts`
> 3. mounted backend controllers under `services/backend/src/controllers/*.ts`
>
> This file is intentionally backend-owned. If S2 behavior changes, update this document first and treat it as the canonical contract for S1.

---

## 1. Contract conventions

### 1.1 Success envelope

Most REST endpoints return:

```ts
interface ApiSuccess<T> {
  success: true;
  data?: T;
}
```

Exceptions currently mounted in code:

- `GET /health` returns the raw health object without a top-level `success` field.
- `GET /api/projects/:id/overview` returns the raw `ProjectOverviewResponse` object without a top-level `success` field.
- `GET /api/files/:fileId/download` returns `text/plain`, not JSON.
- `GET /api/projects/:pid/source/files` returns extra top-level fields beside `data`.

### 1.2 Error envelope

Async/controller errors handled by `error-handler.middleware.ts` return:

```ts
interface ApiError {
  success: false;
  error: string;
  errorDetail?: {
    code:
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "CONFLICT"
      | "ADAPTER_UNAVAILABLE"
      | "LLM_UNAVAILABLE"
      | "LLM_HTTP_ERROR"
      | "LLM_PARSE_ERROR"
      | "LLM_TIMEOUT"
      | "AGENT_UNAVAILABLE"
      | "AGENT_TIMEOUT"
      | "SAST_UNAVAILABLE"
      | "SAST_TIMEOUT"
      | "BUILD_AGENT_UNAVAILABLE"
      | "BUILD_AGENT_TIMEOUT"
      | "KB_UNAVAILABLE"
      | "KB_HTTP_ERROR"
      | "PIPELINE_STEP_FAILED"
      | "DB_ERROR"
      | "INTERNAL_ERROR";
    message: string;
    requestId?: string;
    retryable: boolean;
  };
}
```

Synchronous controller validation errors sometimes return only:

```json
{ "success": false, "error": "..." }
```

### 1.3 Common rules

- All timestamps are ISO 8601 strings.
- IDs are server-generated strings (`project-*`, `sdk-*`, `analysis-*`, `pipe-*`, etc.).
- Protected routes require `Authorization: Bearer <token>` when auth middleware is enabled.
- `401 { success: false, error: "Authentication required" }` is the current protected-route auth failure shape.

---

## 2. Core shared models

Only the currently relevant shared types for active S1↔S2 surfaces are repeated here.

### 2.1 Project

```ts
interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
```

```ts
interface ProjectListItem extends Project {
  lastAnalysisAt?: string;
  severitySummary?: { critical: number; high: number; medium: number; low: number };
  gateStatus?: "pass" | "fail" | "warning";
  unresolvedDelta?: number;
}
```

### 2.2 Uploaded file (DB-backed file API)

```ts
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  language?: string;
  projectId?: string;
  path?: string;
  createdAt?: string;
}
```

### 2.3 Source tree entry (filesystem-backed source API)

`GET /api/projects/:pid/source/files` returns `SourceFileEntry[]` from `ProjectSourceService`:

```ts
type SourceFileType =
  | "source"
  | "config"
  | "build"
  | "script"
  | "doc"
  | "linker"
  | "executable"
  | "object"
  | "shared-lib"
  | "archive"
  | "image"
  | "unknown";

interface SourceFileEntry {
  relativePath: string;
  size: number;
  language: string;
  fileType: SourceFileType;
  previewable: boolean;
}
```

### 2.4 Build / SDK models

```ts
type SdkProfileId = string;

interface BuildProfile {
  sdkId: SdkProfileId;
  compiler: string;
  compilerVersion?: string;
  targetArch: string;
  languageStandard: string;
  headerLanguage: "c" | "cpp" | "auto";
  includePaths?: string[];
  defines?: Record<string, string>;
  flags?: string[];
}
```

```ts
interface SdkProfile {
  id: SdkProfileId;
  name: string;
  vendor: string;
  description: string;
  defaults: Omit<BuildProfile, "sdkId">;
}
```

```ts
type SdkRegistryStatus =
  | "uploading"
  | "extracting"
  | "analyzing"
  | "verifying"
  | "ready"
  | "verify_failed";

interface SdkAnalyzedProfile {
  compiler?: string;
  compilerPrefix?: string;
  gccVersion?: string;
  targetArch?: string;
  languageStandard?: string;
  sysroot?: string;
  environmentSetup?: string;
  includePaths?: string[];
  defines?: Record<string, string>;
}

interface RegisteredSdk {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  path: string;
  profile?: SdkAnalyzedProfile;
  status: SdkRegistryStatus;
  verifyError?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 2.5 Build target / target library

```ts
type BuildTargetStatus =
  | "discovered"
  | "resolving"
  | "configured"
  | "resolve_failed"
  | "building"
  | "built"
  | "build_failed"
  | "scanning"
  | "scanned"
  | "scan_failed"
  | "graphing"
  | "graphed"
  | "graph_failed"
  | "ready";

interface BuildTarget {
  id: string;
  projectId: string;
  name: string;
  relativePath: string;
  includedPaths?: string[];
  sourcePath?: string;
  buildProfile: BuildProfile;
  buildSystem?: "cmake" | "make" | "custom";
  buildCommand?: string;
  status: BuildTargetStatus;
  compileCommandsPath?: string;
  buildLog?: string;
  sastScanId?: string;
  scaLibraries?: Array<{ name: string; version?: string; path: string; repoUrl?: string }>;
  codeGraphStatus?: "pending" | "ingested" | "failed";
  codeGraphNodeCount?: number;
  lastBuiltAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

```ts
interface TargetLibrary {
  id: string;
  targetId: string;
  projectId: string;
  name: string;
  version?: string;
  path: string;
  included: boolean;
  modifiedFiles: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 2.6 Analysis / dynamic-test / report / auth / notification models

```ts
type AnalysisTrackerStatus = "running" | "completed" | "failed" | "aborted";
type AnalysisPhase =
  | "queued"
  | "rule_engine"
  | "llm_chunk"
  | "merging"
  | "complete"
  | "quick_sast"
  | "deep_submitting"
  | "deep_analyzing"
  | "deep_complete";

interface AnalysisProgress {
  analysisId: string;
  projectId: string;
  status: AnalysisTrackerStatus;
  phase: AnalysisPhase;
  currentChunk: number;
  totalChunks: number;
  totalFiles?: number;
  processedFiles?: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  error?: string;
}
```

```ts
interface DynamicTestConfig {
  testType: "fuzzing" | "pentest";
  targetEcu: string;
  protocol: string;
  targetId: string;
  count?: number;
  strategy: "random" | "boundary" | "scenario";
}

interface DynamicTestResult {
  id: string;
  projectId: string;
  config: DynamicTestConfig;
  status: "pending" | "running" | "completed" | "failed" | "aborted";
  totalRuns: number;
  crashes: number;
  anomalies: number;
  findings: DynamicTestFinding[];
  createdAt: string;
}

interface DynamicTestFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  type: "crash" | "anomaly" | "timeout";
  input: string;
  response?: string;
  description: string;
  llmAnalysis?: string;
}
```

```ts
interface Notification {
  id: string;
  projectId: string;
  type: "analysis_complete" | "critical_finding" | "approval_pending" | "gate_failed";
  title: string;
  body: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
  resourceId?: string;
  read: boolean;
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  role: "viewer" | "analyst" | "admin";
  createdAt: string;
  updatedAt: string;
}
```

```ts
interface ModuleReport {
  meta: {
    generatedAt: string;
    projectId: string;
    projectName: string;
    module: "static_analysis" | "dynamic_analysis" | "dynamic_testing" | "deep_analysis";
  };
  summary: {
    totalFindings: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  };
  runs: Array<{ run: Run; gate?: GateResult }>;
  findings: Array<{ finding: Finding; evidenceRefs: EvidenceRef[] }>;
  gateResults: GateResult[];
}

interface ProjectReport {
  generatedAt: string;
  projectId: string;
  projectName: string;
  modules: {
    static?: ModuleReport;
    dynamic?: ModuleReport;
    test?: ModuleReport;
    deep?: ModuleReport;
  };
  totalSummary: ModuleReport["summary"];
  approvals: ApprovalRequest[];
  auditTrail: AuditLogEntry[];
  customization?: {
    executiveSummary?: string;
    companyName?: string;
    logoUrl?: string;
    language?: string;
    reportTitle?: string;
  };
}
```

---

## 3. REST surface contract

## 3.1 Project surface

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/projects` | `{ name: string; description?: string }` | `201 { success, data: Project }` | `201`, `400 name is required` |
| GET | `/api/projects` | - | `200 { success, data: ProjectListItem[] }` | `200` |
| GET | `/api/projects/:id` | - | `200 { success, data: Project }` | `200`, `404` |
| PUT | `/api/projects/:id` | `{ name?: string; description?: string }` | `200 { success, data: Project }` | `200`, `404` |
| DELETE | `/api/projects/:id` | - | `200 { success: true }` | `200`, `404` |
| GET | `/api/projects/:id/overview` | - | raw `ProjectOverviewResponse` | `200`, `404` |

`ProjectOverviewResponse` currently has this shape:

```ts
interface ProjectOverviewResponse {
  project: Project;
  fileCount: number;
  summary: {
    totalVulnerabilities: number;
    bySeverity: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    byModule: { static: number; dynamic: number; test: number };
  };
  targetSummary?: { total: number; ready: number; failed: number; running: number; discovered: number };
  recentAnalyses: AnalysisResult[];
  trend?: { newFindings: number; resolvedFindings: number; unresolvedTotal: number };
}
```

## 3.2 File surface (`UploadedFile` store)

These routes are DB-backed metadata/content routes, distinct from `/source/*` filesystem routes.

| Method | Path | Success | Status codes |
|---|---|---|---|
| GET | `/api/projects/:projectId/files` | `200 { success, data: UploadedFile[] }` | `200` |
| GET | `/api/files/:fileId/content` | `200 { success, data: { id, name, path, language, content } }` | `200`, `404` |
| GET | `/api/files/:fileId/download` | `200 text/plain` | `200`, `404` |
| DELETE | `/api/projects/:projectId/files/:fileId` | `200 { success: true }` | `200`, `404` |

## 3.3 Source upload / source tree surface

### Upload

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/projects/:pid/source/upload` | `multipart/form-data`, field name `file`, up to 200 files | `202 { success, data: { uploadId, status: "received" } }` | `202`, `400`, `404` |
| GET | `/api/projects/:pid/source/upload-status/:uploadId` | - | `200 { success, data: UploadStatus }` | `200`, `404` |

```ts
type UploadPhase = "received" | "extracting" | "indexing" | "complete" | "failed";

interface UploadStatus {
  uploadId: string;
  phase: UploadPhase;
  message: string;
  fileCount?: number;
  projectPath?: string;
  error?: string;
}
```

### Clone / browse / read / delete

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/projects/:pid/source/clone` | `{ gitUrl: string; branch?: string }` | `200 { success, data: { projectPath, fileCount, files } }` | `200`, `400`, `404` |
| GET | `/api/projects/:pid/source/files` | `?filter=source` optional | `200 { success, data: SourceFileEntry[], composition, totalFiles, totalSize, targetMapping? }` | `200`, `404` |
| GET | `/api/projects/:pid/source/file` | `?path=<relative-path>` | `200 { success, data: { path, content, size, language, fileType, previewable, lineCount? } }` | `200`, `400`, `404` |
| DELETE | `/api/projects/:pid/source` | - | `200 { success: true }` | `200` |

Notes:

- `filter=source` returns the backend's default C/C++ filtered set.
- no `filter` returns the full file tree.
- `targetMapping` is keyed by `relativePath` and contains `{ targetId, targetName }` when build targets exist.

## 3.4 Build-target surface

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| GET | `/api/projects/:pid/targets` | - | `200 { success, data: BuildTarget[] }` | `200`, `404` |
| POST | `/api/projects/:pid/targets` | `{ name, relativePath, buildProfile, buildSystem?, includedPaths? }` | `201 { success, data: BuildTarget }` | `201`, `400`, `404` |
| PUT | `/api/projects/:pid/targets/:id` | `{ name?, relativePath?, buildProfile?, buildSystem? }` | `200 { success, data: BuildTarget }` | `200`, `404` |
| DELETE | `/api/projects/:pid/targets/:id` | - | `200 { success: true }` | `200`, `404` |
| GET | `/api/projects/:pid/targets/:id/build-log` | - | `200 { success, data: { buildLog: string \| null, status: BuildTargetStatus, updatedAt: string } }` | `200`, `404` |
| POST | `/api/projects/:pid/targets/discover` | empty body | `200 { success, data: { discovered, created, targets, elapsedMs } }` | `200`, `400`, `404` |

Validation enforced today:

- `relativePath` is required on create and must not contain `..`.
- `includedPaths` entries must not contain `..`.
- target update does **not** currently accept `includedPaths` changes.

## 3.5 Target-library surface

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| GET | `/api/projects/:pid/targets/:tid/libraries` | - | `200 { success, data: TargetLibrary[] }` | `200`, `404` |
| PATCH | `/api/projects/:pid/targets/:tid/libraries` | `{ libraries: Array<{ id: string; included: boolean }> }` | `200 { success, data: TargetLibrary[] }` | `200`, `400`, `404` |

## 3.6 SDK surface

### Project SDK routes

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| GET | `/api/projects/:pid/sdk` | - | `200 { success, data: { builtIn: SdkProfile[], registered: RegisteredSdk[] } }` | `200`, `404` |
| GET | `/api/projects/:pid/sdk/:id` | - | `200 { success, data: RegisteredSdk }` | `200`, `404` |
| POST | `/api/projects/:pid/sdk` | see note below | `202 { success, data: RegisteredSdk }` | `202`, `400`, `404` |
| DELETE | `/api/projects/:pid/sdk/:id` | - | `200 { success: true }` | `200`, `404` |

`POST /api/projects/:pid/sdk` mounted behavior today:

- required: `name`
- accepted JSON body: `{ name: string; description?: string; localPath?: string }`
- controller also checks `req.file?.buffer`, but **this route does not currently mount multer**, so JSON `localPath` is the only guaranteed mounted input path.
- returned `RegisteredSdk.status` is initially `"uploading"`, then the async pipeline moves it through `extracting → analyzing → verifying → ready | verify_failed`.

### SDK profile lookup routes

| Method | Path | Success | Status codes |
|---|---|---|---|
| GET | `/api/sdk-profiles` | `200 { success, data: SdkProfile[] }` | `200` |
| GET | `/api/sdk-profiles/:id` | `200 { success, data: SdkProfile }` | `200`, `404` |

## 3.7 Pipeline surface

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/projects/:pid/pipeline/run` | `{ targetIds?: string[] }` | `202 { success, data: { pipelineId, status: "running" } }` | `202`, `404` |
| POST | `/api/projects/:pid/pipeline/run/:targetId` | empty body | `202 { success, data: { targetId, status: "running" } }` | `202`, `404` |
| GET | `/api/projects/:pid/pipeline/status` | - | `200 { success, data: PipelineStatus }` | `200`, `404` |

```ts
type PipelinePhase = "setup" | "build" | "ready";

interface PipelineStatus {
  targets: Array<{
    id: string;
    name: string;
    status: BuildTargetStatus;
    phase: PipelinePhase;
    compileCommandsPath?: string;
    sastScanId?: string;
    codeGraphNodeCount?: number;
    lastBuiltAt?: string;
  }>;
  readyCount: number;
  failedCount: number;
  totalCount: number;
}
```

Current phase mapping is controller-derived:

- `setup`: `discovered | resolving | configured | resolve_failed`
- `ready`: `ready`
- `build`: everything else

## 3.8 Analysis surface

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/analysis/run` | `{ projectId: string; targetIds?: string[]; mode?: "full" \| "subproject" }` | `202 { success, data: { analysisId, status: "running" } }` | `202`, `400` |
| GET | `/api/analysis/status` | - | `200 { success, data: AnalysisProgress[] }` | `200` |
| GET | `/api/analysis/status/:analysisId` | - | `200 { success, data: AnalysisProgress }` | `200`, `404` |
| POST | `/api/analysis/abort/:analysisId` | - | `200 { success, data: { analysisId, status: "aborted" } }` | `200`, `404` |
| GET | `/api/analysis/results` | `?projectId=<id>` | `200 { success, data: AnalysisResult[] }` | `200`, `400` |
| GET | `/api/analysis/results/:analysisId` | - | `200 { success, data: AnalysisResult }` | `200`, `404` |
| DELETE | `/api/analysis/results/:analysisId` | - | `200 { success: true }` | `200`, `404` |
| GET | `/api/analysis/summary` | `?projectId=<id>&period=30d` | `200 { success, data: StaticAnalysisDashboardSummary }` | `200`, `400` |
| POST | `/api/analysis/poc` | `{ projectId: string; findingId: string }` | `200 { success, data: { findingId, poc, audit } }` | `200`, `400`, `404`, `502` |

Validation rules enforced on `POST /api/analysis/run`:

- `projectId` required.
- if `mode === "subproject"`, `targetIds` must be non-empty.
- if `mode === "full"`, `targetIds` must be omitted/empty.
- if `mode` is omitted, backend preserves existing targetIds-based behavior.

`GET /api/analysis/summary` notes:

- `period` defaults to `30d`.
- `all` disables the lower-bound date.
- unsupported period strings currently degrade to `all` behavior.

## 3.9 Dynamic-test surface

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/dynamic-test/run` | `{ projectId, config, adapterId, testId? }` | `200 { success, data: DynamicTestResult }` | `200`, `400` |
| GET | `/api/dynamic-test/results` | `?projectId=<id>` | `200 { success, data: DynamicTestResult[] }` | `200`, `400` |
| GET | `/api/dynamic-test/results/:testId` | - | `200 { success, data: DynamicTestResult }` | `200`, `404` |
| DELETE | `/api/dynamic-test/results/:testId` | - | `200 { success: true }` | `200`, `404` |

Validation rules enforced today:

- `config.testType` must be `fuzzing | pentest`.
- `config.strategy` must be `random | boundary | scenario`.
- if `strategy === "random"`, `count` must be `1..1000`.

## 3.10 Report surface

### Built-in reports

| Method | Path | Query | Success | Status codes |
|---|---|---|---|---|
| GET | `/api/projects/:pid/report` | `severity,status,runId,from,to` optional | `200 { success, data: ProjectReport }` | `200`, `404` |
| GET | `/api/projects/:pid/report/static` | same filters | `200 { success, data: ModuleReport }` | `200`, `404` |
| GET | `/api/projects/:pid/report/dynamic` | same filters | `200 { success, data: ModuleReport }` | `200`, `404` |
| GET | `/api/projects/:pid/report/test` | same filters | `200 { success, data: ModuleReport }` | `200`, `404` |

Query parsing rules:

- `severity` and `status` are comma-separated lists.
- `runId`, `from`, `to` are optional single strings.

### Custom report

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/projects/:pid/report/custom` | see body below | `200 { success, data: ProjectReport }` | `200`, `404` |

```ts
interface CustomReportRequest {
  filters?: {
    severity?: string[];
    status?: string[];
    runId?: string;
    from?: string;
    to?: string;
  };
  findingIds?: string[];
  includeSections?: {
    executiveSummary?: boolean;
    static?: boolean;
    dynamic?: boolean;
    test?: boolean;
    deep?: boolean;
    approvals?: boolean;
    auditTrail?: boolean;
  };
  customization?: {
    executiveSummary?: string;
    companyName?: string;
    logoUrl?: string;
    language?: string;
    reportTitle?: string;
  };
}
```

## 3.11 Notification surface

| Method | Path | Success | Status codes |
|---|---|---|---|
| GET | `/api/projects/:pid/notifications` | `200 { success, data: Notification[] }` | `200` |
| GET | `/api/projects/:pid/notifications?unread=true` | `200 { success, data: Notification[] }` | `200` |
| GET | `/api/projects/:pid/notifications/count` | `200 { success, data: { unread: number } }` | `200` |
| PATCH | `/api/projects/:pid/notifications/read-all` | `200 { success: true }` | `200` |
| PATCH | `/api/notifications/:id/read` | `200 { success: true }` | `200` |

## 3.12 Auth surface

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/auth/login` | `{ username: string; password: string }` | `200 { success, data: { token, user } }` | `200`, `400` |
| POST | `/api/auth/logout` | Bearer token optional | `200 { success: true }` | `200` |
| GET | `/api/auth/me` | Bearer token | `200 { success, data: User }` | `200`, `401` |
| GET | `/api/auth/users` | - | `200 { success, data: User[] }` | `200` |

Notes:

- login failure is currently `400 Invalid username or password`, not `401`.
- `/api/auth/*` is auth-exempt at middleware level so login/logout/me/users remain reachable even when global auth is enabled.
- `/api/auth/me` still returns `401 Not authenticated` when `req.user` is absent.

## 3.13 Additional mounted REST surfaces

### Project settings / adapters

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| GET | `/api/projects/:pid/settings` | - | `200 { success, data: ProjectSettings }` | `200` |
| PUT | `/api/projects/:pid/settings` | partial project settings | `200 { success, data: ProjectSettings }` | `200` |
| GET | `/api/projects/:pid/adapters` | - | `200 { success, data: Adapter[] }` | `200` |
| POST | `/api/projects/:pid/adapters` | `{ name, url }` | `201 { success, data: Adapter }` | `201`, `400` |
| PUT | `/api/projects/:pid/adapters/:id` | `{ name?, url? }` | `200 { success, data: Adapter }` | `200`, `400`, `404` |
| DELETE | `/api/projects/:pid/adapters/:id` | - | `200 { success: true }` | `200`, `404` |
| POST | `/api/projects/:pid/adapters/:id/connect` | - | `200 { success, data: Adapter }` | `200`, `404` |
| POST | `/api/projects/:pid/adapters/:id/disconnect` | - | `200 { success, data: Adapter }` | `200`, `404` |

Validation notes:

- adapter `url` must currently start with `ws://` or `wss://`.
- project settings validation is service-driven rather than controller-driven.

### Runs / findings / gates / approvals / activity

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| GET | `/api/projects/:pid/runs` | - | `200 { success, data: Run[] }` | `200` |
| GET | `/api/runs/:id` | - | `200 { success, data: RunDetail }` | `200`, `404` |
| GET | `/api/projects/:pid/findings` | query `status,severity,module,sourceType,q,sort,order` optional | `200 { success, data: Finding[] }` | `200`, `400` |
| GET | `/api/projects/:pid/findings/summary` | - | `200 { success, data: AnalysisSummaryLike }` | `200` |
| GET | `/api/projects/:pid/findings/groups` | query `groupBy=ruleId|location` | `200 { success, data: Array<{ key, count, topSeverity, findingIds }> }` | `200`, `400` |
| PATCH | `/api/findings/bulk-status` | `{ findingIds, status, reason, actor? }` | `200 { success, data: { updated, failed } }` | `200`, `400` |
| GET | `/api/findings/:id/history` | - | `200 { success, data: FindingHistoryEntry[] }` | `200`, `404` |
| GET | `/api/findings/:id` | - | `200 { success, data: FindingDetail }` | `200`, `404` |
| PATCH | `/api/findings/:id/status` | `{ status, reason, actor? }` | `200 { success, data: Finding }` | `200`, `400`, `404` |
| GET | `/api/projects/:pid/gates` | - | `200 { success, data: GateResult[] }` | `200` |
| GET | `/api/projects/:pid/gates/runs/:runId` | - | `200 { success, data: GateResult }` | `200`, `404` |
| GET | `/api/gates/:id` | - | `200 { success, data: GateResult }` | `200`, `404` |
| POST | `/api/gates/:id/override` | `{ reason, actor? }` | `201 { success, data: ApprovalRequest }` | `201`, `400`, `404`, `409` |
| GET | `/api/projects/:pid/approvals/count` | - | `200 { success, data: { pending, total } }` | `200` |
| GET | `/api/projects/:pid/approvals` | query `status=pending` optional | `200 { success, data: ApprovalRequest[] }` | `200` |
| GET | `/api/approvals/:id` | - | `200 { success, data: ApprovalRequest }` | `200`, `404` |
| POST | `/api/approvals/:id/decide` | `{ decision, comment?, actor? }` | `200 { success, data: ApprovalRequest }` | `200`, `400`, `404` |
| GET | `/api/projects/:pid/activity` | query `limit=1..50` optional | `200 { success, data: ActivityEntry[] }` | `200` |

Notable current behavior:

- `/api/projects/:pid/approvals?status=` only special-cases `pending`; other values currently fall back to the full list.
- invalid `limit` on `/api/projects/:pid/activity` falls back to the default (`10`) instead of producing `400`.

### Dynamic-analysis surface

| Method | Path | Request | Success | Status codes |
|---|---|---|---|---|
| POST | `/api/dynamic-analysis/sessions` | `{ projectId, adapterId }` | `201 { success, data: DynamicAnalysisSession }` | `201`, `400` |
| GET | `/api/dynamic-analysis/sessions` | query `projectId` optional | `200 { success, data: DynamicAnalysisSession[] }` | `200` |
| GET | `/api/dynamic-analysis/sessions/:id` | - | `200 { success, data: DynamicAnalysisSession }` | `200`, `404` |
| POST | `/api/dynamic-analysis/sessions/:id/start` | - | `200 { success, data: DynamicAnalysisSession }` | `200`, `400` |
| DELETE | `/api/dynamic-analysis/sessions/:id` | - | `200 { success, data: DynamicAnalysisSession }` | `200`, `404` |
| GET | `/api/dynamic-analysis/scenarios` | - | `200 { success, data: AttackScenario[] }` | `200` |
| POST | `/api/dynamic-analysis/sessions/:id/inject` | `{ canId, dlc, data, label? }` | `200 { success, data: CanInjectionResponse }` | `200`, `400` |
| POST | `/api/dynamic-analysis/sessions/:id/inject-scenario` | `{ scenarioId }` | `200 { success, data: CanInjectionResponse[] }` | `200`, `400` |
| GET | `/api/dynamic-analysis/sessions/:id/injections` | - | `200 { success, data: CanInjectionResponse[] }` | `200` |

### Health surface

`GET /health` returns a bare JSON object, not the default success envelope:

```ts
interface HealthResponse {
  service: string;
  status: "ok" | "degraded" | "unhealthy";
  version: string;
  detail: { version: string; uptime: number };
  llmGateway?: unknown;
  analysisAgent?: unknown;
  sastRunner?: unknown;
  knowledgeBase?: unknown;
  buildAgent?: unknown;
  adapters: { total: number; connected: number };
}
```

---

## 4. WebSocket surface contract

### 4.1 Transport rules

Backend WS broadcasters serialize messages as JSON and automatically append:

```ts
interface WsEnvelopeMeta {
  channel: "dynamic-analysis" | "static-analysis" | "dynamic-test" | "analysis" | "upload" | "pipeline" | "sdk" | "notification";
  projectId?: string;
  timestamp: number;
  seq?: number;
}
```

Actual runtime behavior today:

- payloads are sent as `{ ...message, meta }`.
- `meta.projectId` is the broadcaster subscription key.
  - project-scoped channels: real `projectId`
  - `/ws/upload`: current value is `uploadId`
  - `/ws/analysis`: current value is `analysisId`
  - `/ws/dynamic-test`: current value is `testId`

S1 should therefore treat `meta.projectId` as routing metadata, not as a guaranteed real project id on non-project-scoped channels.

### 4.2 Dynamic-analysis WS — `/ws/dynamic-analysis?sessionId=<sessionId>`

| `type` | Payload |
|---|---|
| `message` | `CanMessage` |
| `alert` | `DynamicAlert` |
| `status` | `{ messageCount, alertCount }` |
| `injection-result` | `CanInjectionResponse` |
| `injection-error` | `{ error }` |

### 4.3 Static-analysis WS — `/ws/static-analysis?analysisId=<analysisId>`

| `type` | Payload |
|---|---|
| `static-progress` | `{ analysisId, phase, currentChunk?, totalChunks?, totalFiles?, processedFiles?, message?, phaseWeights? }` |
| `static-warning` | `{ analysisId, code, message }` |
| `static-complete` | `{ analysisId, resultId, findingCount, summary }` |
| `static-error` | `{ analysisId, error }` |

Current static phases:

- `queued`
- `rule_engine`
- `llm_chunk`
- `merging`
- `complete`

### 4.4 Upload WS — `/ws/upload?uploadId=<uploadId>`

| `type` | Payload |
|---|---|
| `upload-progress` | `{ uploadId, phase: "received" \| "extracting" \| "indexing", message, fileCount? }` |
| `upload-complete` | `{ uploadId, fileCount, projectPath }` |
| `upload-error` | `{ uploadId, phase: "failed", error }` |

### 4.5 Pipeline WS — `/ws/pipeline?projectId=<projectId>`

| `type` | Payload |
|---|---|
| `pipeline-target-status` | `{ projectId, targetId, targetName, status: BuildTargetStatus, message, phase: "setup" \| "build" \| "ready" }` |
| `pipeline-complete` | `{ projectId, readyCount, failedCount, totalCount }` |
| `pipeline-error` | `{ projectId, targetId, targetName, phase, error }` |

Implementation note:

- `pipeline-error.phase` is currently emitted from the catch path and should be treated as a coarse phase indicator, not a guaranteed exact failing step.

### 4.6 SDK WS — `/ws/sdk?projectId=<projectId>`

| `type` | Payload |
|---|---|
| `sdk-progress` | `{ sdkId, phase, message }` |
| `sdk-complete` | `{ sdkId, profile }` |
| `sdk-error` | `{ sdkId, error }` |

`phase` aligns with current SDK pipeline states (`uploading`, `extracting`, `analyzing`, `verifying`, `ready`) plus error termination.

### 4.7 Analysis WS — `/ws/analysis?analysisId=<analysisId>`

| `type` | Payload |
|---|---|
| `analysis-progress` | `{ analysisId, phase, message, targetName?, targetProgress?: { current, total } }` |
| `analysis-quick-complete` | `{ analysisId, findingCount }` |
| `analysis-deep-complete` | `{ analysisId, findingCount }` |
| `analysis-error` | `{ analysisId, phase: "quick" \| "deep", error, retryable, partial? }` |

Current progress phases:

- `quick_sast`
- `quick_complete`
- `deep_submitting`
- `deep_analyzing`
- `deep_retrying`
- `deep_complete`

### 4.8 Dynamic-test WS — `/ws/dynamic-test?testId=<testId>`

| `type` | Payload |
|---|---|
| `test-progress` | `{ testId, current, total, crashes, anomalies, message }` |
| `test-finding` | `{ testId, finding }` |
| `test-complete` | `{ testId }` |
| `test-error` | `{ testId, error }` |

### 4.9 Notification WS — `/ws/notifications?projectId=<projectId>`

| `type` | Payload |
|---|---|
| `notification` | `Notification` |

---

## 5. Canonical drift notes resolved by this document

These points are intentional contract clarifications and should be preserved unless code changes:

1. `UploadedFile` APIs and `/source/*` APIs are different surfaces with different backing stores and shapes.
2. `ProjectOverviewResponse` is a raw object, not the common success envelope.
3. SDK file-upload is service-capable but not currently mounted with multipart middleware on `/api/projects/:pid/sdk`.
4. `SourceFileEntry.fileType` uses the current 12-value filesystem classifier from `ProjectSourceService`, not older ad-hoc labels.
5. WS `meta.projectId` equals the subscription key on non-project channels today.
6. `pipeline-error.phase` is currently only a coarse catch-path phase hint, not an exact failed-step contract.
