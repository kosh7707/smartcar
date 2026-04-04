# Frontend ↔ Backend contract drift audit (worker 3)

Scope reviewed:

- targets/discover
- build-target update (`includedPaths`)
- SDK register/list/detail + SDK WS payloads
- pipeline run/retry/status + pipeline WS payloads

## Mismatch matrix

### 1) `POST /api/projects/:pid/targets/discover`

- Frontend expectation: `discoverBuildTargets()` expects `data` to be `BuildTarget[]`, and `useBuildTargets().discover()` writes that array directly into state (`services/frontend/src/renderer/api/pipeline.ts:54-60`, `services/frontend/src/renderer/hooks/useBuildTargets.ts:56-66`).
- Backend current behavior: controller returns `data: { discovered, created, targets, elapsedMs }` (`services/backend/src/controllers/build-target.controller.ts:108-135`).
- Impact: live response is an object, not an array, so target state would be corrupted after discovery. Frontend mock still returns `data.TARGETS`, which hides the drift in tests/mocks (`services/frontend/src/renderer/api/mock-handler.ts:112-115`).
- Recommended follow-up: canonicalize on one shape. Lowest-risk fix is frontend reading `res.data.targets`; alternatively flatten backend/docs to `BuildTarget[]`, but update all callers/docs/tests together.

### 2) `PUT /api/projects/:pid/targets/:id` with `includedPaths`

- Frontend expectation: edit flow sends `includedPaths`, and UI tests assert it is persisted (`services/frontend/src/renderer/api/pipeline.ts:31-45`, `services/frontend/src/renderer/components/static/BuildTargetSection.test.tsx:107-123`).
- Backend current behavior: controller/service/DAO ignore `includedPaths` entirely on update; only `name`, `relativePath`, `buildProfile`, and `buildSystem` flow through, and SQL update never touches `included_paths` or `source_path` (`services/backend/src/controllers/build-target.controller.ts:56-68`, `services/backend/src/services/build-target.service.ts:66-73`, `services/backend/src/dao/build-target.dao.ts:72-123`).
- Impact: edit dialog can report success while selected files are unchanged; isolated subproject copies are never refreshed.
- Recommended follow-up: either implement true backend update support for `includedPaths` (validation + persistence + subproject recopy semantics) or stop exposing editable included-paths in the frontend until backend support exists.

### 3) `POST /api/projects/:pid/sdk`

- Frontend expectation: register helpers expect `{ sdkId }` (`services/frontend/src/renderer/api/sdk.ts:75-107`), and `ProjectSettingsPage` destructures `sdkId` immediately for optimistic UI rows (`services/frontend/src/renderer/pages/ProjectSettingsPage.tsx:201-219`).
- Backend current behavior: backend returns the full `RegisteredSdk` object from `sdkService.register()` (`services/backend/src/controllers/sdk.controller.ts:30-58`, `services/backend/src/services/sdk.service.ts:59-109`).
- Impact: `sdkId` becomes `undefined` in live UI, breaking optimistic rows and WS correlation by id.
- Recommended follow-up: choose one canonical shape. Either return full `RegisteredSdk` everywhere, or change backend to return `{ sdkId }`; then align frontend page/types/tests with that choice.

### 4) SDK analyzed profile field naming (REST + WS)

- Frontend expectation: local SDK profile type/UI use `envSetupScript` (`services/frontend/src/renderer/api/sdk.ts:13-23`, `services/frontend/src/renderer/pages/ProjectSettingsPage.tsx:79-97`).
- Backend current behavior: shared/backend model uses `environmentSetup`; backend verify call and `sdk-complete` payload preserve that field name (`services/shared/src/models.ts:209-220`, `services/backend/src/services/sdk.service.ts:193-212`).
- Impact: environment setup script can exist in backend/shared data but never render in the frontend profile panel.
- Recommended follow-up: stop shadowing the shared type in frontend; import shared `SdkAnalyzedProfile` or rename frontend field to `environmentSetup` consistently.

### 5) `POST /api/projects/:pid/pipeline/run/:targetId`

- Frontend expectation: helper types response as `{ pipelineId }` (`services/frontend/src/renderer/api/pipeline.ts:117-125`).
- Backend current behavior: backend returns `{ targetId, status: "running" }` (`services/backend/src/controllers/pipeline.controller.ts:46-73`). Frontend mock still returns a pipelineId-shaped object (`services/frontend/src/renderer/api/mock-handler.ts:159-165`).
- Impact: current hook ignores the body so the bug is latent, but any future consumer using `pipelineId` will fail in production while mocks still pass.
- Recommended follow-up: either return a real `pipelineId` from backend retry, or change frontend helper/tests/docs to the actual `{ targetId, status }` contract.

### 6) `GET /api/projects/:pid/pipeline/status`

- Frontend expectation: published type requires each target to include `{ id, name, status, phase, message }` (`services/frontend/src/renderer/api/pipeline.ts:128-139`).
- Backend current behavior: backend omits `message` and instead adds `compileCommandsPath`, `sastScanId`, `codeGraphNodeCount`, and `lastBuiltAt` (`services/backend/src/controllers/pipeline.controller.ts:75-104`).
- Impact: this is currently unused, but the published frontend type is stale and would mislead future callers/docs. Mock status also returns raw `data.TARGETS`, not the backend shape (`services/frontend/src/renderer/api/mock-handler.ts:159-162`).
- Recommended follow-up: update frontend types/docs to the live response shape, or add `message` server-side if UI restore requires it.

### 7) WS `/ws/pipeline?projectId=` error payload

- Frontend expectation: `usePipelineProgress()` derives failed status from `payload.phase` in `pipeline-error` (`services/frontend/src/renderer/hooks/usePipelineProgress.ts:81-94`).
- Backend current behavior: orchestrator always emits `phase: "build"` in the catch block, even when the actual failure was `resolve_failed` or `scan_failed`; richer status only exists on `pipeline-target-status` messages (`services/backend/src/services/pipeline-orchestrator.ts:77-95`, `394-410`).
- Impact: frontend cannot reliably reconstruct the true failed phase from the error event alone, so restore/retry UI may mislabel failures.
- Recommended follow-up: include concrete failed status/phase in `pipeline-error` payload, e.g. `resolve_failed`, `build_failed`, `scan_failed`, or `graph_failed`, and consume that directly in the frontend.

## Mostly aligned surfaces

- `POST /api/projects/:pid/pipeline/run` is aligned on `{ pipelineId, status }` between frontend and backend (`services/frontend/src/renderer/api/pipeline.ts:104-115`, `services/backend/src/controllers/pipeline.controller.ts:24-44`).
- SDK WS channel URL and event names align (`services/frontend/src/renderer/api/sdk.ts:113-115`, `services/backend/src/services/sdk.service.ts:206-235`).
- Pipeline WS `pipeline-target-status` and `pipeline-complete` payloads broadly align with the frontend hook; the main drift is reduced `pipeline-error` phase fidelity.

## Recommended sequencing

1. Fix the response-shape breakages that can corrupt live state now: `targets/discover`, SDK register, pipeline retry.
2. Decide whether build-target edit truly supports `includedPaths`; if yes, implement backend persistence + recopy semantics before updating docs.
3. Remove frontend-local SDK type drift by reusing shared types where possible.
4. Re-record mock-handler fixtures/tests after the canonical contract is chosen so drift is caught in CI instead of hidden by mocks.
