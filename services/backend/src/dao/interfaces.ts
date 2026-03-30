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
  BuildProfile,
  BuildTargetStatus,
  ScaLibrary,
} from "@aegis/shared";
import type { StoredFile } from "./file-store";

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

export interface IBuildTargetDAO {
  save(target: BuildTarget): void;
  findById(id: string): BuildTarget | undefined;
  findByProjectId(projectId: string): BuildTarget[];
  update(
    id: string,
    fields: { name?: string; relativePath?: string; buildProfile?: BuildProfile; buildSystem?: string; status?: BuildTargetStatus },
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
    },
  ): BuildTarget | undefined;
  delete(id: string): boolean;
  deleteByProjectId(projectId: string): number;
}
