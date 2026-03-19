import {
  Project,
  Rule,
  Adapter,
  AnalysisResult,
  AnalysisSummary,
  UploadedFile,
  DynamicAnalysisSession,
  DynamicTestConfig,
  DynamicTestResult,
  DynamicTestFinding,
  CanMessage,
  DynamicAlert,
  CanInjectionResponse,
  Run,
  Finding,
  EvidenceRef,
  FindingStatus,
  AuditLogEntry,
  GateResult,
  ApprovalRequest,
  ModuleReport,
  ProjectReport,
  AnalysisModule,
} from "./models";

// ============================================================
// 프로젝트
// ============================================================

export interface ProjectCreateRequest {
  name: string;
  description?: string;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
}

export interface ProjectResponse {
  success: boolean;
  data?: Project;
  error?: string;
}

export interface ProjectListResponse {
  success: boolean;
  data: Project[];
}

// ============================================================
// 프로젝트 Overview (대시보드 대체)
// ============================================================

export interface ProjectOverviewResponse {
  project: Project;
  fileCount: number;
  summary: {
    totalVulnerabilities: number;
    bySeverity: AnalysisSummary;
    byModule: {
      static: number;
      dynamic: number;
      test: number;
    };
  };
  recentAnalyses: AnalysisResult[];
}

// ============================================================
// 정적 분석
// ============================================================

export interface StaticAnalysisRequest {
  projectId: string;
  files: UploadedFile[];
  options?: Record<string, unknown>;
}

export interface StaticAnalysisResponse {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
}

// ============================================================
// 프로젝트 파일 관리
// ============================================================

export interface ProjectFilesResponse {
  success: boolean;
  data: UploadedFile[];
}

// ============================================================
// 동적 분석
// ============================================================

export interface DynamicAnalysisSessionRequest {
  projectId: string;
  adapterId: string;
}

export interface DynamicAnalysisSessionResponse {
  success: boolean;
  data?: DynamicAnalysisSession;
  error?: string;
}

// WebSocket 메시지 (S2 → S1 push)
export type WsMessageType = "message" | "alert" | "status" | "injection-result" | "injection-error";

export interface WsCanMessage {
  type: "message";
  payload: CanMessage;
}

export interface WsAlert {
  type: "alert";
  payload: DynamicAlert;
}

export interface WsStatus {
  type: "status";
  payload: {
    messageCount: number;
    alertCount: number;
  };
}

export interface WsInjectionResult {
  type: "injection-result";
  payload: CanInjectionResponse;
}

export interface WsInjectionError {
  type: "injection-error";
  payload: { error: string };
}

export type WsMessage = WsCanMessage | WsAlert | WsStatus | WsInjectionResult | WsInjectionError;

// ============================================================
// 정적 분석 WS 메시지
// ============================================================

export interface WsStaticProgress {
  type: "static-progress";
  payload: {
    analysisId: string;
    phase: "queued" | "rule_engine" | "llm_chunk" | "merging" | "complete";
    current: number;
    total: number;
    message: string;
    phaseWeights?: Record<string, number>;
  };
}

export interface WsStaticWarning {
  type: "static-warning";
  payload: {
    analysisId: string;
    code: string;
    message: string;
  };
}

export interface WsStaticComplete {
  type: "static-complete";
  payload: { analysisId: string };
}

export interface WsStaticError {
  type: "static-error";
  payload: {
    analysisId: string;
    error: string;
  };
}

export type WsStaticMessage =
  | WsStaticProgress
  | WsStaticWarning
  | WsStaticComplete
  | WsStaticError;

// ============================================================
// 동적 테스트
// ============================================================

export interface DynamicTestRequest {
  projectId: string;
  config: DynamicTestConfig;
  adapterId: string;
}

export interface DynamicTestResponse {
  success: boolean;
  data?: DynamicTestResult;
  error?: string;
}

// ============================================================
// 동적 테스트 WS 메시지
// ============================================================

export interface WsTestProgress {
  type: "test-progress";
  payload: {
    testId: string;
    current: number;
    total: number;
    crashes: number;
    anomalies: number;
    message: string;
  };
}

export interface WsTestFinding {
  type: "test-finding";
  payload: {
    testId: string;
    finding: DynamicTestFinding;
  };
}

export interface WsTestComplete {
  type: "test-complete";
  payload: { testId: string };
}

export interface WsTestError {
  type: "test-error";
  payload: {
    testId: string;
    error: string;
  };
}

export type WsTestMessage =
  | WsTestProgress
  | WsTestFinding
  | WsTestComplete
  | WsTestError;

// ============================================================
// Quick → Deep 분석 WebSocket 메시지
// ============================================================

export interface WsAnalysisProgress {
  type: "analysis-progress";
  payload: {
    analysisId: string;
    phase: "quick_sast" | "quick_complete" | "deep_submitting" | "deep_analyzing" | "deep_complete";
    message: string;
  };
}

export interface WsAnalysisQuickComplete {
  type: "analysis-quick-complete";
  payload: {
    analysisId: string;
    findingCount: number;
  };
}

export interface WsAnalysisDeepComplete {
  type: "analysis-deep-complete";
  payload: {
    analysisId: string;
    findingCount: number;
  };
}

export interface WsAnalysisError {
  type: "analysis-error";
  payload: {
    analysisId: string;
    phase: "quick" | "deep";
    error: string;
    retryable: boolean;
  };
}

export type WsAnalysisMessage =
  | WsAnalysisProgress
  | WsAnalysisQuickComplete
  | WsAnalysisDeepComplete
  | WsAnalysisError;

// ============================================================
// 룰
// ============================================================

export interface RuleCreateRequest {
  name: string;
  pattern: string;
  severity?: string;
  description?: string;
  suggestion?: string;
  fixCode?: string;
}

export interface RuleUpdateRequest {
  name?: string;
  pattern?: string;
  severity?: string;
  description?: string;
  suggestion?: string;
  fixCode?: string;
  enabled?: boolean;
}

export interface RuleResponse {
  success: boolean;
  data?: Rule;
  error?: string;
}

export interface RuleListResponse {
  success: boolean;
  data: Rule[];
}

// ============================================================
// 공통
// ============================================================

// ── 어댑터 ──

export interface AdapterCreateRequest {
  name: string;
  url: string;
}

export interface AdapterUpdateRequest {
  name?: string;
  url?: string;
}

export interface AdapterListResponse {
  success: boolean;
  data: Adapter[];
}

export interface AdapterResponse {
  success: boolean;
  data?: Adapter;
  error?: string;
}

export interface HealthResponse {
  service: string;
  status: "ok" | "error";
  version: string;
}

// ============================================================
// Run
// ============================================================

export interface RunListResponse {
  success: boolean;
  data: Run[];
}

export interface RunDetailResponse {
  success: boolean;
  data?: {
    run: Run;
    gate?: GateResult;
    findings: Array<{ finding: Finding; evidenceRefs: EvidenceRef[] }>;
  };
  error?: string;
}

// ============================================================
// Finding
// ============================================================

export interface FindingListResponse {
  success: boolean;
  data: Finding[];
}

export interface FindingDetailResponse {
  success: boolean;
  data?: Finding & { evidenceRefs: EvidenceRef[]; auditLog: AuditLogEntry[] };
  error?: string;
}

export interface FindingStatusUpdateRequest {
  status: FindingStatus;
  reason: string;
  actor?: string;
}

export interface FindingSummaryResponse {
  success: boolean;
  data: {
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    total: number;
  };
}

// ============================================================
// Quality Gate
// ============================================================

export interface GateResultResponse {
  success: boolean;
  data?: GateResult;
  error?: string;
}

export interface GateResultListResponse {
  success: boolean;
  data: GateResult[];
}

export interface GateOverrideRequest {
  reason: string;
  actor?: string;
}

// ============================================================
// Approval
// ============================================================

export interface ApprovalListResponse {
  success: boolean;
  data: ApprovalRequest[];
}

export interface ApprovalDetailResponse {
  success: boolean;
  data?: ApprovalRequest;
  error?: string;
}

export interface ApprovalDecisionRequest {
  decision: "approved" | "rejected";
  comment?: string;
  actor?: string;
}

// ============================================================
// Report
// ============================================================

export interface ModuleReportResponse {
  success: boolean;
  data?: ModuleReport;
  error?: string;
}

export interface ProjectReportResponse {
  success: boolean;
  data?: ProjectReport;
  error?: string;
}

// ============================================================
// 분석 진행률 (Part A: 비동기 분석)
// ============================================================

export type AnalysisPhase = "queued" | "rule_engine" | "llm_chunk" | "merging" | "complete" | "quick_sast" | "deep_submitting" | "deep_analyzing" | "deep_complete";
export type AnalysisTrackerStatus = "running" | "completed" | "failed" | "aborted";

export interface AnalysisProgress {
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

export interface AnalysisStatusResponse {
  success: boolean;
  data?: AnalysisProgress;
  error?: string;
}

export interface AnalysisStatusListResponse {
  success: boolean;
  data: AnalysisProgress[];
}

export interface AnalysisRunAcceptedResponse {
  success: boolean;
  data?: {
    analysisId: string;
    status: AnalysisTrackerStatus;
  };
  error?: string;
}

// ============================================================
// 정적 분석 대시보드 집계 (Part B)
// ============================================================

export interface StaticAnalysisDashboardSummary {
  // 분포
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;

  // 랭킹
  topFiles: Array<{ filePath: string; findingCount: number; topSeverity: string }>;
  topRules: Array<{ ruleId: string; hitCount: number }>;

  // 트렌드
  trend: Array<{ date: string; runCount: number; findingCount: number; gatePassCount: number }>;

  // KPI
  gateStats: { total: number; passed: number; failed: number; rate: number };
  unresolvedCount: { open: number; needsReview: number; needsRevalidation: number; sandbox: number };
}

export interface StaticDashboardResponse {
  success: boolean;
  data?: StaticAnalysisDashboardSummary;
  error?: string;
}
