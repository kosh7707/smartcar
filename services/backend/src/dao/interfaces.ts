import type {
  Project,
  Run,
  Finding,
  FindingStatus,
  Severity,
  AnalysisModule,
  EvidenceRef,
  GateResult,
  ApprovalRequest,
  ApprovalStatus,
  AuditLogEntry,
  AnalysisResult,
  Adapter,
  DynamicAnalysisSession,
  DynamicAlert,
  CanMessage,
  DynamicTestResult,
  DynamicTestFinding,
  AnalysisStatus,
  UploadedFile,
  BuildTarget,
  AnalysisExecution,
  BuildProfile,
  BuildTargetStatus,
  ScaLibrary,
  Notification,
  ProjectSourceAsset,
  SdkAsset,
} from "@aegis/shared";
import type { StoredFile } from "./file-store";

export type BuildUnitStatus = "active" | "superseded" | "archived";
export type BuildRequestType = "build-only" | "retry" | "reanalyze";
export type BuildRequestStatus =
  | "submitted"
  | "accepted"
  | "attempting"
  | "snapshot_created"
  | "failed"
  | "cancelled";
export type BuildAttemptProjectionStatus = "created" | "running" | "failed" | "succeeded";

export interface BuildSelectionManifestExclusion {
  path: string;
  reason: string;
}

export interface BuildSelectionManifest {
  files: string[];
  excluded: BuildSelectionManifestExclusion[];
}

export type BuildMaterialRef = string | {
  id?: string;
  path?: string;
  uri?: string;
  metadata?: Record<string, unknown>;
};

export interface DeclaredBuildSpec {
  mode: string;
  sdkId?: string;
  setupScriptRef?: BuildMaterialRef;
  toolchainTriplet?: string;
  metadata?: Record<string, unknown>;
}

export interface BuildArtifactRecord {
  kind: string;
  path: string;
  required?: boolean;
  metadata?: Record<string, unknown>;
}

export interface BuildExecutionMaterialRecord {
  projectPath?: string;
  buildScriptRef?: BuildMaterialRef;
  buildDirRef?: BuildMaterialRef;
  buildCommand?: string;
  buildEnvironment?: Record<string, string>;
  compileCommandsRef?: BuildMaterialRef;
  metadata?: Record<string, unknown>;
}

export interface BuildUnitRecord {
  id: string;
  projectId: string;
  name: string;
  relativePath: string;
  status: BuildUnitStatus;
  latestRevisionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuildUnitRevisionRecord {
  id: string;
  buildUnitId: string;
  projectId?: string;
  sourceAssetId: string;
  buildTargetAssetId: string;
  sdkAssetId?: string;
  revisionNumber: number;
  includedPaths: string[];
  selectionManifest: BuildSelectionManifest;
  declaredBuild: DeclaredBuildSpec;
  expectedArtifacts: BuildArtifactRecord[];
  frozenAt: string;
  supersedesRevisionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuildRequestRecord {
  id: string;
  projectId: string;
  buildUnitId: string;
  buildUnitRevisionId: string;
  requestType: BuildRequestType;
  requestedBy: string;
  requestedSnapshotId?: string;
  requestedAttemptId?: string;
  buildScriptRef?: BuildMaterialRef;
  status: BuildRequestStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface BuildAttemptProjectionRecord {
  id: string;
  projectId?: string;
  buildRequestId: string;
  buildUnitId: string;
  buildUnitRevisionId: string;
  attemptNumber: number;
  status: BuildAttemptProjectionStatus;
  failureCategory?: string;
  failureDetail?: string;
  executionMaterial: BuildExecutionMaterialRecord;
  producedArtifacts: BuildArtifactRecord[];
  startedAt?: string;
  completedAt?: string;
  retryOfAttemptId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuildSnapshotProjectionRecord {
  id: string;
  projectId?: string;
  snapshotSchemaVersion: string;
  buildUnitId: string;
  buildUnitRevisionId: string;
  sourceBuildAttemptId: string;
  declaredBuild: DeclaredBuildSpec;
  executionMaterial: BuildExecutionMaterialRecord;
  producedArtifacts: BuildArtifactRecord[];
  thirdPartyInventoryRef?: string;
  successMetadata?: Record<string, unknown>;
  parentSnapshotId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BuildTargetAssetRecord {
  id: string;
  projectId: string;
  buildUnitId: string;
  buildUnitRevisionId: string;
  sourceAssetId: string;
  rootPath?: string;
  relativePath?: string;
  assetPath?: string;
  selectionManifest: BuildSelectionManifest;
  createdAt: string;
  updatedAt: string;
}

// TODO(S2): add a dedicated source-assets DAO/table only after the project-source contract is frozen.

// ── Core Domain ──

export interface IRunDAO {
  save(run: Run): void;
  findById(id: string): Run | undefined;
  findByProjectId(projectId: string): Run[];
  findByAnalysisResultId(analysisResultId: string): Run | undefined;
  updateFindingCount(id: string, count: number): void;
  trendByModule(
    projectId: string,
    module: string,
    since?: string,
  ): Array<{ date: string; runCount: number; findingCount: number; gatePassCount: number }>;
  findLatestCompletedRuns(projectId: string, limit: number): Run[];
}

export interface FindingFilters {
  status?: FindingStatus | FindingStatus[];
  severity?: Severity | Severity[];
  module?: AnalysisModule;
  runId?: string;
  from?: string;
  to?: string;
  q?: string;
  sourceType?: string;
  sort?: "severity" | "createdAt" | "location";
  order?: "asc" | "desc";
}

export interface IFindingDAO {
  save(finding: Finding): void;
  saveMany(findings: Finding[]): void;
  findById(id: string): Finding | undefined;
  findByRunId(runId: string): Finding[];
  findByProjectId(projectId: string, filters?: FindingFilters): Finding[];
  findByIds(ids: string[]): Finding[];
  findByFingerprint(projectId: string, fingerprint: string): Finding | undefined;
  findAllByFingerprint(projectId: string, fingerprint: string): Finding[];
  updateStatus(id: string, status: FindingStatus): void;
  withTransaction<T>(fn: () => T): T;
  summaryByProjectId(projectId: string): { byStatus: Record<string, number>; bySeverity: Record<string, number>; total: number };
  summaryByModule(
    projectId: string,
    module: string,
    since?: string,
  ): { bySeverity: Record<string, number>; byStatus: Record<string, number>; bySource: Record<string, number>; total: number };
  topFilesByModule(
    projectId: string,
    module: string,
    limit?: number,
    since?: string,
  ): Array<{ filePath: string; findingCount: number; topSeverity: string }>;
  topRulesByModule(
    projectId: string,
    module: string,
    limit?: number,
    since?: string,
  ): Array<{ ruleId: string; hitCount: number }>;
  unresolvedCountByProjectId(projectId: string, opts?: { createdBefore?: string }): number;
  severitySummaryByProjectId(projectId: string): { critical: number; high: number; medium: number; low: number };
  resolvedCountSince(projectId: string, since: string): number;
}

export interface IEvidenceRefDAO {
  save(ref: EvidenceRef): void;
  saveMany(refs: EvidenceRef[]): void;
  findByFindingId(findingId: string): EvidenceRef[];
  findByFindingIds(findingIds: string[]): Map<string, EvidenceRef[]>;
}

export interface IGateResultDAO {
  save(result: GateResult): void;
  findById(id: string): GateResult | undefined;
  findByRunId(runId: string): GateResult | undefined;
  findByProjectId(projectId: string): GateResult[];
  updateOverride(id: string, override: GateResult["override"]): void;
  statsByProject(
    projectId: string,
    since?: string,
  ): { total: number; passed: number; failed: number; rate: number };
  latestByProjectId(projectId: string): GateResult | undefined;
}

export interface IApprovalDAO {
  save(request: ApprovalRequest): void;
  findById(id: string): ApprovalRequest | undefined;
  findByTargetId(targetId: string): ApprovalRequest[];
  findByProjectId(projectId: string, status?: ApprovalStatus): ApprovalRequest[];
  findPending(): ApprovalRequest[];
  updateStatus(id: string, status: ApprovalStatus, decision?: ApprovalRequest["decision"]): void;
}

export interface IAuditLogDAO {
  save(entry: AuditLogEntry): void;
  findByResourceId(resourceId: string): AuditLogEntry[];
  findByResourceIds(resourceIds: string[], limit?: number): AuditLogEntry[];
  findFindingStatusChanges(projectId: string, limit: number): AuditLogEntry[];
  findApprovalDecisions(projectId: string, limit: number): AuditLogEntry[];
}

// ── Static/Dynamic Analysis ──

export interface IAnalysisResultDAO {
  save(result: AnalysisResult): void;
  findById(id: string): AnalysisResult | undefined;
  findAll(): AnalysisResult[];
  findByModule(module: string): AnalysisResult[];
  findByProjectId(projectId: string): AnalysisResult[];
  findByExecutionId(analysisExecutionId: string, module?: AnalysisModule): AnalysisResult[];
  deleteById(id: string): boolean;
}

export interface IFileStore {
  save(file: StoredFile): void;
  findById(id: string): StoredFile | undefined;
  findByIds(ids: string[]): StoredFile[];
  findByProjectId(projectId: string): UploadedFile[];
  countByProjectId(projectId: string): number;
  delete(id: string): void;
  deleteByProjectAndFile(fileId: string, projectId: string): boolean;
}

export interface IDynamicSessionDAO {
  save(session: DynamicAnalysisSession): void;
  findById(id: string): DynamicAnalysisSession | undefined;
  findAll(): DynamicAnalysisSession[];
  findByProjectId(projectId: string): DynamicAnalysisSession[];
  updateStatus(id: string, status: string): void;
  stop(id: string, endedAt: string): void;
  updateCounts(id: string, messageCount: number, alertCount: number): void;
}

export interface IDynamicAlertDAO {
  save(alert: DynamicAlert, sessionId: string): void;
  findBySessionId(sessionId: string): DynamicAlert[];
  updateLlmAnalysis(alertId: string, llmAnalysis: string): void;
}

export interface IDynamicMessageDAO {
  save(sessionId: string, msg: CanMessage): void;
  findBySessionId(sessionId: string): CanMessage[];
  findRecent(sessionId: string, limit: number): CanMessage[];
  countBySessionId(sessionId: string): number;
}

export interface IDynamicTestResultDAO {
  save(result: DynamicTestResult): void;
  findById(id: string): DynamicTestResult | undefined;
  findByProjectId(projectId: string): DynamicTestResult[];
  updateResult(
    id: string,
    updates: {
      status: AnalysisStatus;
      totalRuns: number;
      crashes: number;
      anomalies: number;
      findings: DynamicTestFinding[];
    },
  ): void;
  deleteById(id: string): boolean;
}

// ── Infrastructure ──

export interface IProjectDAO {
  save(project: Project): void;
  findById(id: string): Project | undefined;
  findAll(): Project[];
  update(id: string, fields: { name?: string; description?: string }): Project | undefined;
  delete(id: string): boolean;
}

export interface IAdapterDAO {
  save(adapter: { id: string; name: string; url: string; projectId: string; createdAt: string }): void;
  findAll(): Omit<Adapter, "connected" | "ecuConnected">[];
  findByProjectId(projectId: string): Omit<Adapter, "connected" | "ecuConnected">[];
  findById(id: string): Omit<Adapter, "connected" | "ecuConnected"> | undefined;
  update(id: string, fields: { name?: string; url?: string }): boolean;
  delete(id: string): boolean;
  deleteByProjectId(projectId: string): number;
}

export interface IProjectSettingsDAO {
  get(projectId: string, key: string): string | undefined;
  getAll(projectId: string): Record<string, string>;
  set(projectId: string, key: string, value: string): void;
  deleteKey(projectId: string, key: string): void;
  deleteByProjectId(projectId: string): void;
}

export interface IBuildUnitDAO {
  save(unit: BuildUnitRecord): void;
  findById(id: string): BuildUnitRecord | undefined;
  findByProjectId(projectId: string): BuildUnitRecord[];
  findByRelativePath(projectId: string, relativePath: string): BuildUnitRecord | undefined;
}

export interface IBuildUnitRevisionDAO {
  save(revision: BuildUnitRevisionRecord): void;
  findById(id: string): BuildUnitRevisionRecord | undefined;
  findByBuildUnitId(buildUnitId: string): BuildUnitRevisionRecord[];
  findLatestByBuildUnitId(buildUnitId: string): BuildUnitRevisionRecord | undefined;
}

export interface IBuildRequestDAO {
  save(request: BuildRequestRecord): void;
  findById(id: string): BuildRequestRecord | undefined;
  findByProjectId(projectId: string): BuildRequestRecord[];
  findByBuildUnitId(buildUnitId: string): BuildRequestRecord[];
}

export interface IBuildAttemptProjectionDAO {
  save(attempt: BuildAttemptProjectionRecord): void;
  findById(id: string): BuildAttemptProjectionRecord | undefined;
  findByBuildRequestId(buildRequestId: string): BuildAttemptProjectionRecord[];
  findLatestByBuildRequestId(buildRequestId: string): BuildAttemptProjectionRecord | undefined;
}

export interface IBuildSnapshotProjectionDAO {
  save(snapshot: BuildSnapshotProjectionRecord): void;
  findById(id: string): BuildSnapshotProjectionRecord | undefined;
  findByBuildUnitId(buildUnitId: string): BuildSnapshotProjectionRecord[];
  findLatestByBuildUnitId(buildUnitId: string): BuildSnapshotProjectionRecord | undefined;
  findBySourceBuildAttemptId(buildAttemptId: string): BuildSnapshotProjectionRecord[];
}

export interface IBuildTargetAssetDAO {
  save(asset: BuildTargetAssetRecord): void;
  findById(id: string): BuildTargetAssetRecord | undefined;
  findByBuildUnitRevisionId(buildUnitRevisionId: string): BuildTargetAssetRecord | undefined;
  findByBuildUnitId(buildUnitId: string): BuildTargetAssetRecord[];
}

export interface IBuildTargetDAO {
  save(target: BuildTarget): void;
  findById(id: string): BuildTarget | undefined;
  findByProjectId(projectId: string): BuildTarget[];
  update(
    id: string,
    fields: {
      name?: string;
      relativePath?: string;
      buildProfile?: BuildProfile;
      buildSystem?: string;
      scriptHintPath?: string | null;
      status?: BuildTargetStatus;
      sdkChoiceState?: BuildTarget["sdkChoiceState"];
    },
  ): BuildTarget | undefined;
  updatePipelineState(
    id: string,
    fields: {
      status: BuildTargetStatus;
      compileCommandsPath?: string;
      buildLog?: string;
      sastScanId?: string;
      scaLibraries?: ScaLibrary[];
      codeGraphStatus?: string;
      codeGraphNodeCount?: number;
      lastBuiltAt?: string;
      buildCommand?: string;
      sdkChoiceState?: BuildTarget["sdkChoiceState"];
    },
  ): BuildTarget | undefined;
  delete(id: string): boolean;
  deleteByProjectId(projectId: string): number;
}

export interface IAnalysisExecutionDAO {
  save(execution: AnalysisExecution): void;
  findById(id: string): AnalysisExecution | undefined;
  findByProjectId(projectId: string): AnalysisExecution[];
  findByBuildTargetId(buildTargetId: string): AnalysisExecution[];
  findActiveByBuildTargetId(buildTargetId: string): AnalysisExecution | undefined;
  update(
    id: string,
    fields: Partial<Omit<AnalysisExecution, "id" | "projectId" | "buildTargetId" | "buildTargetName" | "buildTargetRelativePath" | "buildProfileSnapshot" | "createdAt">>,
  ): AnalysisExecution | undefined;
}

export interface IProjectSourceAssetDAO {
  save(asset: ProjectSourceAsset): void;
  findById(id: string): ProjectSourceAsset | undefined;
  findLatestByProjectId(projectId: string): ProjectSourceAsset | undefined;
}

export interface ISdkAssetDAO {
  save(asset: SdkAsset): void;
  findById(id: string): SdkAsset | undefined;
  findByProjectId(projectId: string): SdkAsset[];
  update(assetId: string, fields: Partial<Omit<SdkAsset, "id" | "projectId" | "createdAt">>): SdkAsset | undefined;
  delete(id: string): boolean;
}

export interface INotificationDAO {
  save(notification: {
    id: string;
    projectId: string;
    type: string;
    title: string;
    body: string;
    severity?: string;
    jobKind?: string;
    resourceId?: string;
    correlationId?: string;
    createdAt: string;
  }): void;
  findByProjectId(projectId: string, unreadOnly?: boolean, limit?: number): Notification[];
  unreadCount(projectId: string): number;
  markAsRead(id: string): void;
  markAllAsRead(projectId: string): void;
}
