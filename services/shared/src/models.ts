// ============================================================
// 공통 타입
// ============================================================

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type AnalysisModule = "static_analysis" | "dynamic_analysis" | "dynamic_testing";
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
  createdAt: string;
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
// 룰 관련
// ============================================================

export interface Rule {
  id: string;
  name: string;
  severity: Severity;
  description: string;
  suggestion: string;
  pattern: string;
  fixCode?: string;
  enabled: boolean;
  projectId: string;
  createdAt: string;
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

/** 사전 정의 SDK 프로파일 */
export interface SdkProfile {
  id: SdkProfileId;
  name: string;
  vendor: string;
  description: string;
  defaults: Omit<BuildProfile, "sdkId">;
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

export type FindingStatus =
  | "open"
  | "needs_review"
  | "accepted_risk"
  | "false_positive"
  | "fixed"
  | "needs_revalidation"
  | "sandbox";

export type FindingSourceType = "rule-engine" | "llm-assist" | "both";
export type RunStatus = "pending" | "running" | "completed" | "failed";
export type LocatorType = "line-range" | "packet-range" | "timestamp-window" | "request-response-pair";
export type Confidence = "high" | "medium" | "low";
export type ArtifactType = "analysis-result" | "uploaded-file" | "dynamic-session" | "test-result" | "sast-finding";

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
  ruleId?: string;
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
