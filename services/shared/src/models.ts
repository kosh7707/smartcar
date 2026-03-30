// ============================================================
// 공통 타입
// ============================================================

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type AnalysisModule = "static_analysis" | "dynamic_analysis" | "dynamic_testing" | "deep_analysis";

/**
 * 분석 결과 상태.
 * 전이: pending → running → completed | failed | aborted
 */
export type AnalysisStatus = "pending" | "running" | "completed" | "failed" | "aborted";
export type VulnerabilitySource = "rule" | "llm";

// ============================================================
// 프로젝트
// ============================================================

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 정적 분석 관련
// ============================================================

export interface Vulnerability {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  location?: string;
  source: VulnerabilitySource;
  ruleId?: string;
  suggestion?: string;
  fixCode?: string;
  /** 상세 분석 (공격 경로, 영향 범위, 코드 흐름 등) */
  detail?: string;
}

export interface AnalysisSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface AnalysisWarning {
  code: string;        // "LLM_CHUNK_FAILED" | "LLM_UNAVAILABLE" | "CHUNK_TOO_LARGE" | "FILE_TOO_LARGE" | "CHUNK_INPUT_SIZE_EXCEEDED" | "LLM_NOTE"
  message: string;
  details?: string;
}

export interface FileCoverageEntry {
  fileId: string;
  filePath: string;
  status: "analyzed" | "skipped";
  skipReason?: string;
  findingCount: number;
}

export interface AnalysisResult {
  id: string;
  projectId: string;
  module: AnalysisModule;
  status: AnalysisStatus;
  vulnerabilities: Vulnerability[];
  summary: AnalysisSummary;
  warnings?: AnalysisWarning[];
  analyzedFileIds?: string[];
  fileCoverage?: FileCoverageEntry[];
  /** Agent 분석 한계/불확실성 (caveats) */
  caveats?: string[];
  /** Agent 신뢰도 원본 점수 (0.0~1.0) */
  confidenceScore?: number;
  /** Agent 신뢰도 세부 항목 */
  confidenceBreakdown?: ConfidenceBreakdown;
  /** Agent가 사람 검토 필요 판단 */
  needsHumanReview?: boolean;
  /** Agent 수정 권고 전체 목록 */
  recommendedNextSteps?: string[];
  /** 정책 플래그 (CWE-78, ISO21434 등) */
  policyFlags?: string[];
  /** SCA 라이브러리 목록 */
  scaLibraries?: ScaLibrary[];
  /** 에이전트 감사 요약 */
  agentAudit?: AgentAuditSummary;
  createdAt: string;
}

/** Agent 신뢰도 세부 항목 */
export interface ConfidenceBreakdown {
  grounding: number;
  deterministicSupport: number;
  ragCoverage: number;
  schemaCompliance: number;
}

/** SCA 라이브러리 정보 (S4 응답) */
export interface ScaLibrary {
  name: string;
  version?: string;
  path: string;
  repoUrl?: string;
}

/** 에이전트 감사 요약 (S1 표시용) */
export interface AgentAuditSummary {
  latencyMs: number;
  tokenUsage: { prompt: number; completion: number };
  turnCount?: number;
  toolCallCount?: number;
  terminationReason?: string;
  /** S7에서 실제 사용된 LLM 모델 식별자 (S3 Agent가 전달) */
  modelName?: string;
  /** Agent 시스템 프롬프트 버전 (S3 관리) */
  promptVersion?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  language?: string;
  projectId?: string;
  path?: string;
  createdAt?: string;
}

// ============================================================
// 어댑터
// ============================================================

export interface EcuMeta {
  name: string;
  canIds: string[];
}

export interface Adapter {
  id: string;
  name: string;
  url: string;
  connected: boolean;
  ecuConnected: boolean;
  ecuMeta?: EcuMeta[];
  projectId: string;
  createdAt: string;
}

// ============================================================
// 프로젝트 설정
// ============================================================

export interface ProjectSettings {
  llmUrl: string;
  buildProfile?: BuildProfile;
}

// ============================================================
// 빌드 프로파일 / SDK 프로파일
// ============================================================

/** SDK 프로파일 ID (사전 정의 SDK 또는 "custom") */
export type SdkProfileId = string;

/** 프로젝트의 빌드 환경 설정 */
export interface BuildProfile {
  /** SDK 프로파일 ID — 선택하면 나머지 자동 추론 */
  sdkId: SdkProfileId;
  /** 컴파일러 (SDK에서 추론 또는 사용자 지정) */
  compiler: string;
  /** 컴파일러 버전 (선택) */
  compilerVersion?: string;
  /** 타겟 아키텍처 (SDK에서 추론) */
  targetArch: string;
  /** 언어 표준 (SDK에서 추론 또는 사용자 지정) */
  languageStandard: string;
  /** .h 파일 처리 방식 (SDK에서 추론 또는 사용자 지정) */
  headerLanguage: "c" | "cpp" | "auto";
  /** 추가 인클루드 경로 (선택) */
  includePaths?: string[];
  /** 추가 전처리기 매크로 (선택) */
  defines?: Record<string, string>;
  /** 추가 컴파일 플래그 (선택) */
  flags?: string[];
}

// ── SDK 등록 (유저 관리) ──

export type SdkRegistryStatus =
  | "uploading" | "extracting" | "analyzing"
  | "verifying" | "ready" | "verify_failed";

/** S3 Build Agent가 분석한 SDK 프로파일 */
export interface SdkAnalyzedProfile {
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

/** 유저 등록 SDK (DB 저장, 상태머신: uploading→extracting→analyzing→verifying→ready) */
export interface RegisteredSdk {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  /** SDK 경로 (/uploads/{pid}/sdk/{id}/ 또는 로컬 경로) */
  path: string;
  /** S3 Build Agent가 분석한 프로파일 */
  profile?: SdkAnalyzedProfile;
  status: SdkRegistryStatus;
  /** S4 검증 실패 사유 */
  verifyError?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 사전 정의 SDK 프로파일 (내장, 하드코딩) */
export interface SdkProfile {
  id: SdkProfileId;
  name: string;
  vendor: string;
  description: string;
  defaults: Omit<BuildProfile, "sdkId">;
}

// ============================================================
// 빌드 타겟
// ============================================================

/**
 * 서브 프로젝트(빌드 타겟) 라이프사이클 상태 (16상태 FSM).
 *
 * 정상 경로:
 *   discovered → resolving → configured → building → built → scanning → scanned → graphing → graphed → ready
 *
 * 실패 분기:
 *   resolving → resolve_failed (비치명적: 기존 buildProfile이 있으면 building 진행 가능)
 *   building → build_failed
 *   scanning → scan_failed
 *   graphing → graph_failed (비치명적: ready로 진행 가능)
 *
 * PipelinePhase 매핑:
 *   setup = discovered | resolving | configured | resolve_failed
 *   build = building ~ graph_failed
 *   ready = ready
 */
export type BuildTargetStatus =
  | "discovered" | "resolving" | "configured" | "resolve_failed"
  | "building" | "built" | "build_failed"
  | "scanning" | "scanned" | "scan_failed"
  | "graphing" | "graphed" | "graph_failed"
  | "ready";

/** 프로젝트 내 독립 빌드 단위 (서브 프로젝트) */
export interface BuildTarget {
  id: string;
  projectId: string;
  /** 타겟 이름 (e.g. "gateway", "body-control") */
  name: string;
  /** 메인 빌드 루트 상대 경로 (e.g. "gateway-webserver/") */
  relativePath: string;
  /** 포함할 파일/폴더 경로 목록 (프로젝트 루트 기준 상대 경로) */
  includedPaths?: string[];
  /** 물리적 복사본 경로 (uploads/{projectId}/{targetId}/) — S2가 자동 생성 */
  sourcePath?: string;
  /** 타겟별 독립 빌드 설정 */
  buildProfile: BuildProfile;
  /** 빌드 시스템 (S4 탐색 결과) */
  buildSystem?: "cmake" | "make" | "custom";
  /** S3 Build Agent가 결정한 빌드 명령어 */
  buildCommand?: string;
  /** 라이프사이클 상태 */
  status: BuildTargetStatus;
  /** bear 빌드 결과 compile_commands.json 경로 */
  compileCommandsPath?: string;
  /** 빌드 로그 (실패 시 디버깅용) */
  buildLog?: string;
  /** Quick 분석 결과 ID (→ analysis_results) */
  sastScanId?: string;
  /** SCA 라이브러리 캐시 */
  scaLibraries?: ScaLibrary[];
  /** 코드그래프 KB 적재 상태 */
  codeGraphStatus?: "pending" | "ingested" | "failed";
  /** KB에 적재된 노드 수 */
  codeGraphNodeCount?: number;
  /** 마지막 빌드 시각 */
  lastBuiltAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** 서브 프로젝트 내 서드파티 라이브러리 (S4 식별, 사용자 포함/제외 선택) */
export interface TargetLibrary {
  id: string;
  targetId: string;
  projectId: string;
  name: string;
  version?: string;
  /** 서브프로젝트 내 상대 경로 */
  path: string;
  /** 스캔에 포함 여부 (false=제외, true=포함). 기본 제외. */
  included: boolean;
  /** upstream 대비 수정된 파일 목록 */
  modifiedFiles: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 동적 분석 관련
// ============================================================

export interface CanMessage {
  timestamp: string;
  id: string;
  dlc: number;
  data: string;
  flagged: boolean;
  injected?: boolean;
}

export interface DynamicAlert {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  llmAnalysis?: string;
  relatedMessages: CanMessage[];
  detectedAt: string;
}

export type DynamicSourceType = "adapter";

export interface DynamicSource {
  type: DynamicSourceType;
  adapterId: string;
  adapterName: string;
}

export interface DynamicAnalysisSession {
  id: string;
  projectId: string;
  status: "connected" | "monitoring" | "stopped";
  source: DynamicSource;
  messageCount: number;
  alertCount: number;
  startedAt: string;
  endedAt?: string;
}

// ============================================================
// 동적 테스트 관련
// ============================================================

export type TestType = "fuzzing" | "pentest";
export type TestStrategy = "random" | "boundary" | "scenario";
export type FindingType = "crash" | "anomaly" | "timeout";

export interface DynamicTestConfig {
  testType: TestType;
  targetEcu: string;
  protocol: string;
  targetId: string;
  count?: number;       // random 전략 전용 (기본 10). boundary/scenario는 고정 입력셋 사용
  strategy: TestStrategy;
}

export interface DynamicTestFinding {
  id: string;
  severity: Severity;
  type: FindingType;
  input: string;
  response?: string;
  description: string;
  llmAnalysis?: string;
}

export interface DynamicTestResult {
  id: string;
  projectId: string;
  config: DynamicTestConfig;
  status: AnalysisStatus;
  totalRuns: number;
  crashes: number;
  anomalies: number;
  findings: DynamicTestFinding[];
  createdAt: string;
}

// ============================================================
// CAN 주입 관련
// ============================================================

export interface CanInjectionRequest {
  canId: string;       // "0x7DF"
  dlc: number;         // 0-8
  data: string;        // "FF FF FF FF FF FF FF FF"
  label?: string;      // 사람이 읽을 수 있는 라벨
}

export type InjectionClassification = "normal" | "crash" | "anomaly" | "timeout";

// ============================================================
// SAST 도구 통합 (후속 과제 — SAST 도구 실행 인프라 구축 후 사용)
// ============================================================

export interface SastFindingLocation {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface SastDataFlowStep {
  file: string;
  line: number;
  content?: string;
}

export interface SastFinding {
  toolId: string;                        // "semgrep" | "codeql" | ...
  ruleId: string;                        // e.g. "semgrep:c.lang.security.insecure-use-gets-fn"
  severity: string;                      // 도구의 심각도 (S2가 Severity로 정규화)
  message: string;                       // 도구가 생성한 설명
  location: SastFindingLocation;         // 소스 위치
  dataFlow?: SastDataFlowStep[];         // taint tracking 결과 (선택)
  metadata?: Record<string, unknown>;    // 도구별 추가 정보
}

// ============================================================
// 코어 도메인: Run / Finding / EvidenceRef
// ============================================================

/**
 * Finding 7-상태 라이프사이클.
 *
 * 전이 규칙:
 *   open → needs_review | accepted_risk | false_positive | fixed
 *   sandbox → needs_review | open | false_positive
 *   needs_review → accepted_risk | false_positive | fixed | open
 *   accepted_risk → needs_review | open
 *   false_positive → needs_review | open
 *   fixed → needs_revalidation | open
 *   needs_revalidation → open | fixed | false_positive
 */
export type FindingStatus =
  | "open"
  | "needs_review"
  | "accepted_risk"
  | "false_positive"
  | "fixed"
  | "needs_revalidation"
  | "sandbox";

export type FindingSourceType = "rule-engine" | "llm-assist" | "both" | "agent" | "sast-tool";
export type RunStatus = "pending" | "running" | "completed" | "failed";
export type LocatorType = "line-range" | "packet-range" | "timestamp-window" | "request-response-pair";
export type Confidence = "high" | "medium" | "low";
export type ArtifactType = "analysis-result" | "uploaded-file" | "dynamic-session" | "test-result" | "sast-finding" | "agent-assessment";

export interface Run {
  id: string;
  projectId: string;
  module: AnalysisModule;
  status: RunStatus;
  analysisResultId: string;
  findingCount: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface Finding {
  id: string;
  runId: string;
  projectId: string;
  module: AnalysisModule;
  status: FindingStatus;
  severity: Severity;
  confidence: Confidence;
  sourceType: FindingSourceType;
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  /** 상세 분석 (Agent claim.detail — 공격 경로, 영향 범위, 악용 시나리오 등) */
  detail?: string;
  ruleId?: string;
  /**
   * 동일성 지문. 재분석 시 같은 취약점을 식별하는 데 사용.
   * 생성 규칙: sha256(projectId + location + ruleId|title + sourceType).slice(0,16)
   */
  fingerprint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRef {
  id: string;
  findingId: string;
  artifactId: string;
  artifactType: ArtifactType;
  locatorType: LocatorType;
  locator: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  detail: Record<string, unknown>;
  requestId?: string;
}

export interface CanInjectionResponse {
  id: string;
  request: CanInjectionRequest;
  ecuResponse: {
    success: boolean;
    data?: string;
    error?: "no_response" | "malformed" | "reset" | "delayed";
    delayMs?: number;
  };
  classification: InjectionClassification;
  injectedAt: string;
}

// --- 사전정의 공격 시나리오 ---

export type AttackScenarioId =
  | "dos-burst"
  | "diagnostic-abuse"
  | "replay-attack"
  | "bus-off"
  | "unauthorized-id"
  | "boundary-probe";

export interface AttackScenario {
  id: AttackScenarioId;
  name: string;
  description: string;
  severity: Severity;
  steps: CanInjectionRequest[];
}

// ============================================================
// Report
// ============================================================

export interface ReportMeta {
  generatedAt: string;
  projectId: string;
  projectName: string;
  module: AnalysisModule;
}

export interface ReportSummary {
  totalFindings: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}

export interface RunReportEntry {
  run: Run;
  gate?: GateResult;
}

export interface FindingReportEntry {
  finding: Finding;
  evidenceRefs: EvidenceRef[];
}

export interface ModuleReport {
  meta: ReportMeta;
  summary: ReportSummary;
  runs: RunReportEntry[];
  findings: FindingReportEntry[];
  gateResults: GateResult[];
}

export interface ProjectReport {
  generatedAt: string;
  projectId: string;
  projectName: string;
  modules: {
    static?: ModuleReport;
    dynamic?: ModuleReport;
    test?: ModuleReport;
    deep?: ModuleReport;
  };
  totalSummary: ReportSummary;
  approvals: ApprovalRequest[];
  auditTrail: AuditLogEntry[];
}

// ============================================================
// Quality Gate
// ============================================================

export type GateStatus = "pass" | "fail" | "warning";

export type GateRuleId =
  | "no-critical"
  | "high-threshold"
  | "evidence-coverage"
  | "sandbox-unreviewed";

export interface GateRuleResult {
  ruleId: GateRuleId;
  result: "passed" | "failed" | "warning";
  message: string;
  linkedFindingIds: string[];
}

export interface GateResult {
  id: string;
  runId: string;
  projectId: string;
  status: GateStatus;
  rules: GateRuleResult[];
  evaluatedAt: string;
  override?: {
    overriddenBy: string;
    reason: string;
    approvalId: string;
    overriddenAt: string;
  };
  createdAt: string;
}

// ============================================================
// Approval
// ============================================================

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type ApprovalActionType =
  | "gate.override"
  | "finding.accepted_risk";

export interface ApprovalRequest {
  id: string;
  actionType: ApprovalActionType;
  requestedBy: string;
  targetId: string;
  projectId: string;
  reason: string;
  status: ApprovalStatus;
  decision?: {
    decidedBy: string;
    decidedAt: string;
    comment?: string;
  };
  expiresAt: string;
  createdAt: string;
}
