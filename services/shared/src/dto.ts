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

// ============================================================
// WebSocket 이벤트 타입 레지스트리 (전 서비스 공유 계약)
// ============================================================

/**
 * AEGIS WS 이벤트 타입 — 모든 WS 메시지의 `type` 필드 값을 열거한다.
 *
 * 6개 WS 패밀리:
 * - 동적 분석 (/ws/dynamic-analysis): CAN 메시지 스트리밍 + 알림
 * - 정적 분석 (/ws/static-analysis): 레거시 룰엔진+LLM 청크 진행률
 * - 동적 테스트 (/ws/dynamic-test): 퍼징/침투 테스트 진행률
 * - Quick→Deep 분석 (/ws/analysis): SAST+Agent 2단계 파이프라인
 * - 업로드 (/ws/upload): 소스코드 업로드 상태머신
 * - 파이프라인 (/ws/pipeline): 서브 프로젝트 빌드→스캔→코드그래프
 */
export type WsEventType =
  // 동적 분석 (CAN/ECU)
  | "message" | "alert" | "status" | "injection-result" | "injection-error"
  // 정적 분석 (레거시)
  | "static-progress" | "static-warning" | "static-complete" | "static-error"
  // 동적 테스트
  | "test-progress" | "test-finding" | "test-complete" | "test-error"
  // Quick→Deep 분석
  | "analysis-progress" | "analysis-quick-complete" | "analysis-deep-complete" | "analysis-error"
  // 업로드
  | "upload-progress" | "upload-complete" | "upload-error"
  // 서브 프로젝트 파이프라인
  | "pipeline-target-status" | "pipeline-complete" | "pipeline-error"
  // SDK 등록
  | "sdk-progress" | "sdk-complete" | "sdk-error";

/** WS 채널 식별자 */
export type WsChannel =
  | "dynamic-analysis"
  | "static-analysis"
  | "dynamic-test"
  | "analysis"
  | "upload"
  | "pipeline"
  | "sdk";

/**
 * WS 공통 envelope 메타데이터.
 * 모든 WS 메시지에 선택적으로 첨부 가능 (하위 호환).
 * S1은 meta 필드가 없는 메시지도 처리할 수 있어야 한다.
 */
export interface WsEnvelopeMeta {
  /** WS 채널 (e.g. "pipeline") */
  channel: WsChannel;
  /** 프로젝트 ID (모든 채널 공통) */
  projectId?: string;
  /** epoch ms */
  timestamp: number;
  /** 메시지 일련번호 (채널별 단조증가, gap 감지용) */
  seq?: number;
}

/**
 * WS 공통 envelope. 기존 메시지에 meta를 감싸는 형태.
 * 기존: { type: "pipeline-target-status", payload: {...} }
 * 새:   { type: "pipeline-target-status", payload: {...}, meta: {...} }
 */
export interface WsEnvelope<T extends { type: string }> {
  /** 기존 메시지 내용 (그대로 유지) */
  message: T;
  /** 공통 메타데이터 */
  meta: WsEnvelopeMeta;
}

// ============================================================
// 동적 분석 WS 메시지 (/ws/dynamic-analysis?sessionId=)
// Progress 의미론: messageCount/alertCount 카운터 기반
// ============================================================

/** @deprecated WsEventType으로 대체. 하위 호환용 */
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
// 정적 분석 WS 메시지 (/ws/static-analysis?analysisId=)
// Progress 의미론: current/total 청크 단위 + phaseWeights 가중치
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
// 동적 테스트 WS 메시지 (/ws/dynamic-test?testId=)
// Progress 의미론: current/total 입력 단위 + crashes/anomalies 누적
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
// Quick → Deep 분석 WS 메시지 (/ws/analysis?analysisId=)
// Progress 의미론: phase 기반 상태 전이 + targetName/targetProgress 멀티 타겟
// Phase 전이: quick_sast → quick_complete → deep_submitting → deep_analyzing → deep_complete
// ============================================================

export interface WsAnalysisProgress {
  type: "analysis-progress";
  payload: {
    analysisId: string;
    phase: "quick_sast" | "quick_complete" | "deep_submitting" | "deep_analyzing" | "deep_complete";
    message: string;
    /** 현재 처리 중인 빌드 타겟 이름 */
    targetName?: string;
    /** 전체 타겟 진행률 */
    targetProgress?: { current: number; total: number };
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
// 소스코드 업로드 WS 메시지 (/ws/upload?uploadId=)
// Progress 의미론: phase 기반 상태머신
// Phase 전이: received → extracting → indexing → complete | failed
// ============================================================

/** 업로드 상태머신 단계 */
export type UploadPhase = "received" | "extracting" | "indexing" | "complete" | "failed";

export interface WsUploadProgress {
  type: "upload-progress";
  payload: {
    uploadId: string;
    phase: UploadPhase;
    message: string;
    fileCount?: number;
  };
}

export interface WsUploadComplete {
  type: "upload-complete";
  payload: {
    uploadId: string;
    fileCount: number;
    projectPath: string;
  };
}

export interface WsUploadError {
  type: "upload-error";
  payload: {
    uploadId: string;
    phase: UploadPhase;
    error: string;
  };
}

export type WsUploadMessage = WsUploadProgress | WsUploadComplete | WsUploadError;

// ============================================================
// 서브 프로젝트 파이프라인 WS 메시지 (/ws/pipeline?projectId=)
// Progress 의미론: BuildTargetStatus(16상태) → PipelinePhase(3단계) 매핑
// Phase 매핑: discovered|resolving|configured|resolve_failed → setup, building~graph_failed → build, ready → ready
// ============================================================

import type { BuildTargetStatus } from "./models";

/**
 * 파이프라인 UI 간소화 3단계.
 * - setup: 탐색/구성 중 (discovered, resolving, configured, resolve_failed)
 * - build: 빌드/스캔/코드그래프 진행 중 (building ~ graph_failed)
 * - ready: 완료
 */
export type PipelinePhase = "setup" | "build" | "ready";

export interface WsPipelineTargetStatus {
  type: "pipeline-target-status";
  payload: {
    projectId: string;
    targetId: string;
    targetName: string;
    status: BuildTargetStatus;
    message: string;
    phase: PipelinePhase;
  };
}

export interface WsPipelineComplete {
  type: "pipeline-complete";
  payload: {
    projectId: string;
    readyCount: number;
    failedCount: number;
    totalCount: number;
  };
}

export interface WsPipelineError {
  type: "pipeline-error";
  payload: {
    projectId: string;
    targetId: string;
    targetName: string;
    phase: string;
    error: string;
  };
}

export type WsPipelineMessage = WsPipelineTargetStatus | WsPipelineComplete | WsPipelineError;

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
