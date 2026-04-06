# Worker 2 — Backend route inventory and response-shape audit

## Scope / evidence
- Mount map: `services/backend/src/router-setup.ts:29-64`
- Controller route definitions: `services/backend/src/controllers/*.ts`
- Shared error envelope: `services/backend/src/middleware/error-handler.middleware.ts:7-40`, `services/backend/src/lib/errors.ts:1-118`
- WS upgrade surfaces: `services/backend/src/composition.ts:173-193`, `services/backend/src/index.ts:42-59`

## Cross-cutting contract findings
1. **Most REST successes use `{ success: true, data: ... }`.**
2. **Known success-envelope exceptions:**
   - `GET /health` returns a bare health object, not `{ success, data }`.
   - `GET /api/projects/:id/overview` returns a bare overview object.
   - `GET /api/projects/:pid/source/files` returns `{ success, data, composition, totalFiles, totalSize, targetMapping }` with metadata outside `data`.
   - `GET /api/files/:fileId/download` returns raw `text/plain` bytes with `Content-Disposition`, not JSON.
3. **Error shapes are split across two patterns:**
   - **Inline controller errors** return `{ success: false, error }` only.
   - **Thrown `AppError`s** go through middleware and return `{ success: false, error, errorDetail: { code, message, requestId, retryable } }`.
4. **Async kickoff routes consistently return `202` with a running token**:
   - `POST /api/analysis/run` → `{ analysisId, status: "running" }`
   - `POST /api/projects/:pid/source/upload` → `{ uploadId, status: "received" }`
   - `POST /api/projects/:pid/pipeline/run` → `{ pipelineId, status: "running" }`
   - `POST /api/projects/:pid/pipeline/run/:targetId` → `{ targetId, status: "running" }`
   - `POST /api/projects/:pid/sdk` → accepted/async registration (`202`)
5. **Doc drift candidates worth calling out in the shared-model rewrite:**
   - Mixed success envelopes mean S1 cannot assume every backend success payload is wrapped under `data`.
   - Mixed error envelopes mean S1 cannot assume `errorDetail` is always present.
   - `/api/projects/:pid/sdk` checks `req.file`, but this router does **not** attach upload middleware; the wired request shape today is effectively JSON + `localPath` unless middleware is added elsewhere.

## Mount inventory (router roots)
| Mount root | Controller evidence |
| --- | --- |
| `/api/projects/:pid/adapters` | `router-setup.ts:31`, `project-adapters.controller.ts:9-81` |
| `/api/projects/:pid/settings` | `router-setup.ts:32`, `project-settings.controller.ts:10-17` |
| `/api/projects/:pid/runs` | `router-setup.ts:33`, `run.controller.ts:8-12` |
| `/api/projects/:pid/findings` | `router-setup.ts:34`, `finding.controller.ts:16-62` |
| `/api/projects/:pid/gates` | `router-setup.ts:35`, `quality-gate.controller.ts:12-24` |
| `/api/projects/:pid/approvals` | `router-setup.ts:36`, `approval.controller.ts:12-28` |
| `/api/projects/:pid/report` | `router-setup.ts:37`, `report.controller.ts:43-88` |
| `/api/projects/:pid/activity` | `router-setup.ts:38`, `activity.controller.ts:8-12` |
| `/api/projects/:pid/notifications` | `router-setup.ts:39`, `notification.controller.ts:11-30` |
| `/api/sdk-profiles` | `router-setup.ts:42`, `project-settings.controller.ts:29-39` |
| `/api/gate-profiles` | `router-setup.ts:43`, `project-settings.controller.ts:49-58` |
| `/health` | `router-setup.ts:44`, `health.controller.ts:29-62` |
| `/api/projects` | `router-setup.ts:45`, `project.controller.ts:8-69` |
| `/api` (files) | `router-setup.ts:46`, `file.controller.ts:8-53` |
| `/api/dynamic-analysis` | `router-setup.ts:47`, `dynamic-analysis.controller.ts:12-110` |
| `/api/dynamic-test` | `router-setup.ts:48`, `dynamic-test.controller.ts:13-82` |
| `/api/analysis` | `router-setup.ts:49-52`, `analysis.controller.ts:27-254` |
| `/api/projects/:pid/source` | `router-setup.ts:53`, `project-source.controller.ts:48-152` |
| `/api/projects/:pid/targets` | `router-setup.ts:54`, `build-target.controller.ts:24-127` |
| `/api/projects/:pid/targets/:tid/libraries` | `router-setup.ts:55`, `target-library.controller.ts:15-48` |
| `/api/projects/:pid/sdk` | `router-setup.ts:56`, `sdk.controller.ts:14-68` |
| `/api/projects/:pid/pipeline` | `router-setup.ts:57`, `pipeline.controller.ts:25-104` |
| `/api/runs` | `router-setup.ts:58`, `run.controller.ts:21-29` |
| `/api/findings` | `router-setup.ts:59`, `finding.controller.ts:72-131` |
| `/api/gates` | `router-setup.ts:60`, `quality-gate.controller.ts:38-72` |
| `/api/approvals` | `router-setup.ts:61`, `approval.controller.ts:34-59` |
| `/api/notifications` | `router-setup.ts:62`, `notification.controller.ts:37-43` |
| `/api/auth` | `router-setup.ts:63`, `auth.controller.ts:9-33` |

## Route inventory by domain

### 1) Projects / files / settings / adapters
| Endpoint | Request shape | Success shape | Status / notable 4xx |
| --- | --- | --- | --- |
| `POST /api/projects` | JSON `{ name, description? }` | `201 { success: true, data: Project }` | `400` if `name` missing/blank (`project.controller.ts:8-20`) |
| `GET /api/projects` | none | `{ success: true, data: ProjectWithSummary[] }` | `200` only (`project.controller.ts:22-26`) |
| `GET /api/projects/:id` | path `id` | `{ success: true, data: Project }` | inline `404 Project not found` (`project.controller.ts:28-36`) |
| `PUT /api/projects/:id` | JSON `{ name?, description? }` | `{ success: true, data: Project }` | inline `404` if missing (`project.controller.ts:38-50`) |
| `DELETE /api/projects/:id` | path `id` | `{ success: true }` | inline `404` if missing (`project.controller.ts:52-60`) |
| `GET /api/projects/:id/overview` | path `id` | **bare overview object** | inline `404` if missing (`project.controller.ts:62-69`) |
| `GET /api/projects/:projectId/files` | path `projectId` | `{ success: true, data: UploadedFile[] }` | no project existence check (`file.controller.ts:8-12`) |
| `GET /api/files/:fileId/content` | path `fileId` | `{ success: true, data: { id, name, path, language, content } }` | inline `404 File not found` (`file.controller.ts:14-31`) |
| `GET /api/files/:fileId/download` | path `fileId` | raw text payload | inline `404 File not found` (`file.controller.ts:33-43`) |
| `DELETE /api/projects/:projectId/files/:fileId` | path params | `{ success: true }` | inline `404 File not found` (`file.controller.ts:45-53`) |
| `GET /api/projects/:pid/settings` | path `pid` | `{ success: true, data: ProjectSettings }` | no inline validation (`project-settings.controller.ts:10-13`) |
| `PUT /api/projects/:pid/settings` | JSON partial project settings | `{ success: true, data: ProjectSettings }` | service-level validation only (`project-settings.controller.ts:16-19`) |
| `GET /api/sdk-profiles` | none | `{ success: true, data: SdkProfile[] }` | `200` only (`project-settings.controller.ts:29-31`) |
| `GET /api/sdk-profiles/:id` | path `id` | `{ success: true, data: SdkProfile }` | inline `404 SDK profile not found` (`project-settings.controller.ts:34-39`) |
| `GET /api/gate-profiles` | none | `{ success: true, data: GateProfile[] }` | `200` only (`project-settings.controller.ts:49-51`) |
| `GET /api/gate-profiles/:id` | path `id` | `{ success: true, data: GateProfile }` | inline `404 Gate profile not found` (`project-settings.controller.ts:53-58`) |
| `GET /api/projects/:pid/adapters` | path `pid` | `{ success: true, data: Adapter[] }` | no project existence check (`project-adapters.controller.ts:9-13`) |
| `POST /api/projects/:pid/adapters` | JSON `{ name, url }` | `201 { success: true, data: Adapter }` | inline `400` if missing `name/url` or `url` not `ws://` / `wss://` (`project-adapters.controller.ts:16-30`) |
| `PUT /api/projects/:pid/adapters/:id` | JSON `{ name?, url? }` | `{ success: true, data: Adapter }` | inline `404` if adapter absent / wrong project; `400` if `url` scheme invalid (`project-adapters.controller.ts:32-52`) |
| `DELETE /api/projects/:pid/adapters/:id` | path params | `{ success: true }` | inline `404 Adapter not found` (`project-adapters.controller.ts:55-66`) |
| `POST /api/projects/:pid/adapters/:id/connect` | path params | `{ success: true, data: Adapter }` | inline `404` if adapter absent / wrong project (`project-adapters.controller.ts:68-79`) |
| `POST /api/projects/:pid/adapters/:id/disconnect` | path params | `{ success: true, data: Adapter }` | inline `404` if adapter absent / wrong project (`project-adapters.controller.ts:81-92`) |

### 2) Runs / findings / gates / approvals / reports / activity / notifications
| Endpoint | Request shape | Success shape | Status / notable 4xx |
| --- | --- | --- | --- |
| `GET /api/projects/:pid/runs` | path `pid` | `{ success: true, data: Run[] }` | no explicit 4xx (`run.controller.ts:8-12`) |
| `GET /api/runs/:id` | path `id` | `{ success: true, data: RunDetail }` | inline `404 Run not found` (`run.controller.ts:21-29`) |
| `GET /api/projects/:pid/findings` | query `status,severity,module,sourceType,q,sort,order` | `{ success: true, data: Finding[] }` | invalid query values throw `InvalidInputError` → middleware `400` with `errorDetail` (`finding.controller.ts:16-46`) |
| `GET /api/projects/:pid/findings/summary` | path `pid` | `{ success: true, data: AnalysisSummaryLike }` | `200` only (`finding.controller.ts:48-53`) |
| `GET /api/projects/:pid/findings/groups?groupBy=ruleId|location` | query `groupBy` | `{ success: true, data: Group[] }` | middleware `400` if `groupBy` invalid (`finding.controller.ts:55-68`) |
| `PATCH /api/findings/bulk-status` | JSON `{ findingIds[], status, reason, actor? }` | `{ success: true, data: { updated, failed } }` | middleware `400` for empty/too-large array or missing `status/reason` (`finding.controller.ts:72-94`) |
| `GET /api/findings/:id/history` | path `id` | `{ success: true, data: FindingHistoryEntry[] }` | inline `404 Finding not found` (`finding.controller.ts:96-104`) |
| `GET /api/findings/:id` | path `id` | `{ success: true, data: FindingDetail }` | inline `404 Finding not found` (`finding.controller.ts:106-114`) |
| `PATCH /api/findings/:id/status` | JSON `{ status, reason, actor? }` | `{ success: true, data: Finding }` | inline `400` if `status/reason` missing; service/DAO transition errors bubble as middleware `400` with `errorDetail` (`finding.controller.ts:116-131`, contract test at `api-contract.test.ts:349-370`) |
| `GET /api/projects/:pid/gates` | path `pid` | `{ success: true, data: GateResult[] }` | `200` only (`quality-gate.controller.ts:12-16`) |
| `GET /api/projects/:pid/gates/runs/:runId` | path `runId` | `{ success: true, data: GateResult }` | inline `404 Gate result not found for this run` (`quality-gate.controller.ts:18-24`) |
| `GET /api/gates/:id` | path `id` | `{ success: true, data: GateResult }` | inline `404 Gate result not found` (`quality-gate.controller.ts:38-46`) |
| `POST /api/gates/:id/override` | JSON `{ reason, actor? }` | `201 { success: true, data: Approval }` | inline `400` if missing `reason` or gate already passed; inline `404` if gate missing; inline `409` if already overridden (`quality-gate.controller.ts:48-72`) |
| `GET /api/projects/:pid/approvals/count` | path `pid` | `{ success: true, data: { pending, approved, rejected, total? } }` | `200` only (`approval.controller.ts:12-16`) |
| `GET /api/projects/:pid/approvals` | optional query `status=pending` | `{ success: true, data: Approval[] }` | no validation for other status values; non-`pending` falls back to all (`approval.controller.ts:18-28`) |
| `GET /api/approvals/:id` | path `id` | `{ success: true, data: Approval }` | inline `404 Approval not found` (`approval.controller.ts:34-42`) |
| `POST /api/approvals/:id/decide` | JSON `{ decision, comment?, actor? }` | `{ success: true, data: Approval }` | inline `400` unless `decision` is `approved|rejected` (`approval.controller.ts:44-59`) |
| `GET /api/projects/:pid/report` | query filters `severity,status,runId,from,to` | `{ success: true, data: Report }` | inline `404 Project not found` (`report.controller.ts:43-56`) |
| `GET /api/projects/:pid/report/static|dynamic|test` | same filter query | `{ success: true, data: ModuleReport }` | inline `404 Project not found` (`report.controller.ts:60-74`) |
| `POST /api/projects/:pid/report/custom` | JSON `{ filters?, findingIds?, includeSections?, customization? }` | `{ success: true, data: Report }` | inline `404 Project not found` (`report.controller.ts:77-88`) |
| `GET /api/projects/:pid/activity?limit=1..50` | query `limit` clamped to 1..50, default 10 | `{ success: true, data: ActivityEntry[] }` | no 4xx on bad limit; invalid parse falls back to 10 (`activity.controller.ts:8-12`) |
| `GET /api/projects/:pid/notifications/count` | path `pid` | `{ success: true, data: { unread } }` | `200` only (`notification.controller.ts:11-15`) |
| `PATCH /api/projects/:pid/notifications/read-all` | path `pid` | `{ success: true }` | `200` only (`notification.controller.ts:17-21`) |
| `GET /api/projects/:pid/notifications?unread=true` | query `unread` boolean-ish string | `{ success: true, data: Notification[] }` | only literal `"true"` filters unread (`notification.controller.ts:23-29`) |
| `PATCH /api/notifications/:id/read` | path `id` | `{ success: true }` | no not-found handling at controller (`notification.controller.ts:37-42`) |

### 3) Source import / build targets / libraries / SDK / pipeline
| Endpoint | Request shape | Success shape | Status / notable 4xx |
| --- | --- | --- | --- |
| `POST /api/projects/:pid/source/upload` | `multipart/form-data`, repeated field name **`file`**, max 200 files, 500MB/file | `202 { success: true, data: { uploadId, status: "received" } }` | middleware `400` for invalid `pid` / missing project / no files (`project-source.controller.ts:48-70`) |
| `GET /api/projects/:pid/source/upload-status/:uploadId` | path params | `{ success: true, data: { uploadId, phase, message, ... } }` | middleware `404 Upload not found` (`project-source.controller.ts:73-80`) |
| `POST /api/projects/:pid/source/clone` | JSON `{ gitUrl, branch? }` | `{ success: true, data: { projectPath, fileCount, files: first100 } }` | middleware `400 gitUrl is required`; `404` project missing (`project-source.controller.ts:82-99`) |
| `GET /api/projects/:pid/source/files?filter=source` | query `filter=source` for C/C++ subset, otherwise full tree | **`{ success: true, data: files, composition, totalFiles, totalSize, targetMapping? }`** | middleware `400` invalid `pid`; `404` project missing (`project-source.controller.ts:101-132`) |
| `GET /api/projects/:pid/source/file?path=...` | query `path` required | `{ success: true, data: { path, content, ...meta } }` | middleware `400` if `path` missing (`project-source.controller.ts:134-143`) |
| `DELETE /api/projects/:pid/source` | path `pid` | `{ success: true }` | middleware `400` invalid `pid` (`project-source.controller.ts:146-151`) |
| `GET /api/projects/:pid/targets` | path `pid` | `{ success: true, data: BuildTarget[] }` | middleware `400` invalid `pid`; `404` project missing (`build-target.controller.ts:24-31`) |
| `POST /api/projects/:pid/targets` | JSON `{ name, relativePath, buildProfile?, buildSystem?, includedPaths? }` | `201 { success: true, data: BuildTarget }` | middleware `400` if `name/relativePath` missing, path contains `..`, or included path contains `..`; `404` project missing (`build-target.controller.ts:34-57`) |
| `PUT /api/projects/:pid/targets/:id` | JSON `{ name?, relativePath?, buildProfile?, buildSystem? }` | `{ success: true, data: BuildTarget }` | middleware `404` if target absent / wrong project (`build-target.controller.ts:60-73`) |
| `DELETE /api/projects/:pid/targets/:id` | path params | `{ success: true }` | middleware `404` if target absent / wrong project (`build-target.controller.ts:75-87`) |
| `GET /api/projects/:pid/targets/:id/build-log` | path params | `{ success: true, data: { buildLog, status, updatedAt } }` | middleware `404` if target absent / wrong project (`build-target.controller.ts:89-107`) |
| `POST /api/projects/:pid/targets/discover` | no required JSON body | `{ success: true, data: { discovered, created, targets, elapsedMs } }` | middleware `400` invalid `pid`, no uploaded source, or no SAST client; `404` project missing (`build-target.controller.ts:109-127`) |
| `GET /api/projects/:pid/targets/:tid/libraries` | path params | `{ success: true, data: TargetLibrary[] }` | middleware `404` if project/target missing or mismatched (`target-library.controller.ts:15-26`) |
| `PATCH /api/projects/:pid/targets/:tid/libraries` | JSON `{ libraries: [{ id, included }] }` | `{ success: true, data: TargetLibrary[] }` | middleware `400` if payload missing/malformed; `404` if project/target missing (`target-library.controller.ts:28-48`) |
| `GET /api/projects/:pid/sdk` | path `pid` | `{ success: true, data: RegisteredSdk[] }` | middleware `404` project missing (`sdk.controller.ts:14-20`) |
| `GET /api/projects/:pid/sdk/:id` | path `id` | `{ success: true, data: RegisteredSdk }` | middleware `404 SDK not found` (`sdk.controller.ts:23-29`) |
| `POST /api/projects/:pid/sdk` | JSON `{ name, description?, localPath? }` **or** intended multipart upload via `req.file` | `202 { success: true, data: RegisteredSdk }` | middleware `404` project missing; `400` if `name` missing or neither `localPath` nor `req.file` provided. **No multer is mounted here, so file upload is not actually wired in this controller.** (`sdk.controller.ts:31-59`) |
| `DELETE /api/projects/:pid/sdk/:id` | path `id` | `{ success: true }` | service errors bubble through middleware (`sdk.controller.ts:61-67`) |
| `POST /api/projects/:pid/pipeline/run` | optional JSON `{ targetIds?: string[] }` | `202 { success: true, data: { pipelineId, status: "running" } }` | middleware `400` invalid `pid`; `404` project missing (`pipeline.controller.ts:25-44`) |
| `POST /api/projects/:pid/pipeline/run/:targetId` | path params | `202 { success: true, data: { targetId, status: "running" } }` | middleware `400` invalid `pid`; `404` project/target missing or mismatched (`pipeline.controller.ts:47-74`) |
| `GET /api/projects/:pid/pipeline/status` | path `pid` | `{ success: true, data: { targets, readyCount, failedCount, totalCount } }` | middleware `400` invalid `pid`; `404` project missing (`pipeline.controller.ts:76-103`) |

### 4) Analysis / dynamic analysis / dynamic test / auth / health
| Endpoint | Request shape | Success shape | Status / notable 4xx |
| --- | --- | --- | --- |
| `POST /api/analysis/run` | JSON `{ projectId, targetIds?, mode? }`, where `mode` is `full|subproject` if present | `202 { success: true, data: { analysisId, status: "running" } }` | middleware `400` if `projectId` missing, invalid `mode`, `subproject` without `targetIds`, or `full` with non-empty `targetIds` (`analysis.controller.ts:27-67`, `analysis-validation.test.ts:51-108`) |
| `GET /api/analysis/status` | none | `{ success: true, data: AnalysisProgress[] }` | `200` only (`analysis.controller.ts:70-74`) |
| `GET /api/analysis/status/:analysisId` | path `analysisId` | `{ success: true, data: AnalysisProgress }` | middleware `404 Analysis not found` (`analysis.controller.ts:76-82`) |
| `POST /api/analysis/abort/:analysisId` | path `analysisId` | `{ success: true, data: { analysisId, status: "aborted" } }` | middleware `404` if missing/already complete (`analysis.controller.ts:84-90`) |
| `GET /api/analysis/results?projectId=...` | query `projectId` required | `{ success: true, data: AnalysisResult[] }` | middleware `400` if query missing (`analysis.controller.ts:92-99`) |
| `GET /api/analysis/results/:analysisId` | path `analysisId` | `{ success: true, data: AnalysisResult }` | middleware `404 Analysis result not found`; also falls back to `deep-${analysisId}` lookup (`analysis.controller.ts:101-108`) |
| `DELETE /api/analysis/results/:analysisId` | path `analysisId` | `{ success: true }` | middleware `404 Analysis result not found` (`analysis.controller.ts:110-117`) |
| `GET /api/analysis/summary?projectId=...&period=30d|all|Nd` | query `projectId` required, `period` optional | `{ success: true, data: { bySeverity, byStatus, bySource, topFiles, topRules, trend, gateStats, unresolvedCount } }` | middleware `400` if `projectId` missing. Invalid period silently yields `since=undefined` rather than 4xx (`analysis.controller.ts:119-199`) |
| `POST /api/analysis/poc` | JSON `{ projectId, findingId }` | `{ success: true, data: { findingId, poc: { statement, detail }, audit } }` | middleware `400` if fields missing; middleware `404` if finding missing/project mismatch; **manual** `502 { success:false,error,errorDetail:{ code,message,retryable } }` when agent responds with failure (`analysis.controller.ts:201-254`) |
| `POST /api/dynamic-analysis/sessions` | JSON `{ projectId, adapterId }` | `201 { success: true, data: DynamicSession }` | inline `400` if either field missing (`dynamic-analysis.controller.ts:12-25`) |
| `GET /api/dynamic-analysis/sessions?projectId=...` | optional query `projectId` | `{ success: true, data: DynamicSession[] }` | `200` only (`dynamic-analysis.controller.ts:27-32`) |
| `GET /api/dynamic-analysis/sessions/:id` | path `id` | `{ success: true, data: DynamicSession }` | inline `404 Session not found` (`dynamic-analysis.controller.ts:34-42`) |
| `POST /api/dynamic-analysis/sessions/:id/start` | path `id` | `{ success: true, data: DynamicSession }` | inline `400` if session missing or not `connected` (`dynamic-analysis.controller.ts:44-55`) |
| `DELETE /api/dynamic-analysis/sessions/:id` | path `id` | `{ success: true, data: DynamicSession }` | inline `404 Session not found` (`dynamic-analysis.controller.ts:57-67`) |
| `GET /api/dynamic-analysis/scenarios` | none | `{ success: true, data: AttackScenario[] }` | `200` only (`dynamic-analysis.controller.ts:69-73`) |
| `POST /api/dynamic-analysis/sessions/:id/inject` | JSON `{ canId, dlc, data, label? }` | `{ success: true, data: InjectionResult }` | inline `400` if `canId` missing, `dlc` outside 0..8, or `data` missing (`dynamic-analysis.controller.ts:75-94`) |
| `POST /api/dynamic-analysis/sessions/:id/inject-scenario` | JSON `{ scenarioId }` | `{ success: true, data: InjectionResult[] }` | inline `400` if `scenarioId` missing (`dynamic-analysis.controller.ts:96-105`) |
| `GET /api/dynamic-analysis/sessions/:id/injections` | path `id` | `{ success: true, data: InjectionHistory[] }` | `200` even if history empty (`dynamic-analysis.controller.ts:107-110`) |
| `POST /api/dynamic-test/run` | JSON `{ projectId, adapterId, config, testId? }` | `{ success: true, data: DynamicTestResult }` | inline `400` if `projectId`, `adapterId`, or `config` missing; invalid `config.testType`; invalid `config.strategy`; or random strategy `count` outside 1..1000 (`dynamic-test.controller.ts:13-52`) |
| `GET /api/dynamic-test/results?projectId=...` | query `projectId` required | `{ success: true, data: DynamicTestResult[] }` | inline `400` if query missing (`dynamic-test.controller.ts:54-63`) |
| `GET /api/dynamic-test/results/:testId` | path `testId` | `{ success: true, data: DynamicTestResult }` | inline `404 Test result not found` (`dynamic-test.controller.ts:65-73`) |
| `DELETE /api/dynamic-test/results/:testId` | path `testId` | `{ success: true }` | inline `404 Test result not found` (`dynamic-test.controller.ts:75-82`) |
| `POST /api/auth/login` | JSON `{ username, password }` | `{ success: true, data: AuthResult }` | middleware `400 username and password required` (`auth.controller.ts:9-14`) |
| `POST /api/auth/logout` | optional `Authorization: Bearer <token>` | `{ success: true }` | no 4xx if token absent (`auth.controller.ts:16-20`) |
| `GET /api/auth/me` | auth middleware populates `req.user` | `{ success: true, data: User }` | inline `401 Not authenticated`; app defaults to soft-auth unless `AUTH_REQUIRED=true` (`auth.controller.ts:22-28`, `index.ts:36-40`) |
| `GET /api/auth/users` | none | `{ success: true, data: User[] }` | `200` only (`auth.controller.ts:30-33`) |
| `GET /health` | none | **bare object** `{ service, status, version, detail, llmGateway, analysisAgent, sastRunner, knowledgeBase, buildAgent, adapters }` | no success wrapper; status remains HTTP `200` even when logical status is `degraded`/`unhealthy` (`health.controller.ts:29-62`) |

## WebSocket surfaces used by S1/S1-QA-facing flows
These are not mounted in `router-setup.ts`; they are attached as HTTP upgrade handlers via `attachWsServers()`.

| WS path | Query key | Evidence |
| --- | --- | --- |
| `/ws/notifications` | `projectId` | `composition.ts:173`, `index.ts:57-59` |
| `/ws/dynamic-analysis` | `sessionId` | `composition.ts:187`, `index.ts:57-59` |
| `/ws/static-analysis` | `analysisId` | `composition.ts:188`, `index.ts:57-59` |
| `/ws/dynamic-test` | `testId` | `composition.ts:189`, `index.ts:57-59` |
| `/ws/analysis` | `analysisId` | `composition.ts:190`, `index.ts:57-59` |
| `/ws/upload` | `uploadId` | `composition.ts:191`, `index.ts:57-59` |
| `/ws/pipeline` | `projectId` | `composition.ts:192`, `index.ts:57-59` |
| `/ws/sdk` | `projectId` | `composition.ts:193`, `index.ts:57-59` |

## Suggested doc rewrite focus for `docs/api/shared-models.md`
1. Preserve the **real envelope split** instead of pretending every endpoint is `{ success, data }`.
2. Call out **async token objects** (`analysisId`, `uploadId`, `pipelineId`, `targetId`) as first-class DTOs.
3. Document that **errorDetail is guaranteed only for middleware/AppError paths**, not for every inline 4xx.
4. Keep `/health`, file download, and `/source/files` listed as explicit exceptions.
5. For SDK registration, document the **currently wired JSON+`localPath` path** and flag multipart upload as not mounted in this router.
