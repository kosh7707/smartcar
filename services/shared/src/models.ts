// ============================================================
// 공통 타입
// ============================================================

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type AnalysisModule = "static_analysis" | "dynamic_analysis" | "dynamic_testing";
export type AnalysisStatus = "pending" | "running" | "completed" | "failed";
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
  code: string;        // "LLM_CHUNK_FAILED" | "LLM_UNAVAILABLE" | "CHUNK_TOO_LARGE"
  message: string;
  details?: string;
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
export type ArtifactType = "analysis-result" | "uploaded-file" | "dynamic-session" | "test-result";

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
