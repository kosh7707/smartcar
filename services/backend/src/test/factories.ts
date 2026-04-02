import crypto from "crypto";
import type {
  Project,
  Run,
  Finding,
  EvidenceRef,
  GateResult,
  ApprovalRequest,
  AuditLogEntry,
  AnalysisResult,
  BuildTarget,
  DynamicAnalysisSession,
  DynamicAlert,
  CanMessage,
  DynamicTestResult,
  Notification,
  User,
} from "@aegis/shared";
import type { StoredFile } from "../dao/file-store";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: `proj-${uuid()}`,
    name: "Test Project",
    description: "",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export function makeRun(overrides?: Partial<Run>): Run {
  return {
    id: `run-${uuid()}`,
    projectId: `proj-${uuid()}`,
    module: "static_analysis",
    status: "completed",
    analysisResultId: `analysis-${uuid()}`,
    findingCount: 0,
    startedAt: now(),
    endedAt: now(),
    createdAt: now(),
    ...overrides,
  };
}

export function makeFinding(overrides?: Partial<Finding>): Finding {
  return {
    id: `finding-${uuid()}`,
    runId: `run-${uuid()}`,
    projectId: `proj-${uuid()}`,
    module: "static_analysis",
    status: "open",
    severity: "medium",
    confidence: "high",
    sourceType: "rule-engine",
    title: "Test Finding",
    description: "Test description",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export function makeEvidenceRef(overrides?: Partial<EvidenceRef>): EvidenceRef {
  return {
    id: `evr-${uuid()}`,
    findingId: `finding-${uuid()}`,
    artifactId: `analysis-${uuid()}`,
    artifactType: "analysis-result",
    locatorType: "line-range",
    locator: {},
    createdAt: now(),
    ...overrides,
  };
}

export function makeGateResult(overrides?: Partial<GateResult>): GateResult {
  return {
    id: `gate-${uuid()}`,
    runId: `run-${uuid()}`,
    projectId: `proj-${uuid()}`,
    status: "pass",
    rules: [],
    evaluatedAt: now(),
    createdAt: now(),
    ...overrides,
  };
}

export function makeApproval(overrides?: Partial<ApprovalRequest>): ApprovalRequest {
  return {
    id: `approval-${uuid()}`,
    actionType: "gate.override",
    requestedBy: "analyst",
    targetId: `gate-${uuid()}`,
    projectId: `proj-${uuid()}`,
    reason: "Test reason",
    status: "pending",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now(),
    ...overrides,
  };
}

export function makeAuditLog(overrides?: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: `audit-${uuid()}`,
    timestamp: now(),
    actor: "system",
    action: "test.action",
    resource: "test",
    detail: {},
    ...overrides,
  };
}

export function makeAnalysisResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    id: `analysis-${uuid()}`,
    projectId: `proj-${uuid()}`,
    module: "static_analysis",
    status: "completed",
    vulnerabilities: [],
    summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    createdAt: now(),
    ...overrides,
  };
}


export function makeStoredFile(overrides?: Partial<StoredFile>): StoredFile {
  return {
    id: `file-${uuid()}`,
    projectId: `proj-${uuid()}`,
    name: "test.c",
    size: 100,
    content: "// test content",
    ...overrides,
  };
}

export function makeBuildTarget(overrides?: Partial<BuildTarget>): BuildTarget {
  return {
    id: `target-${uuid()}`,
    projectId: `proj-${uuid()}`,
    name: "test-target",
    relativePath: "src/",
    buildProfile: {
      sdkId: "linux-x86_64-c",
      compiler: "gcc",
      targetArch: "x86_64",
      languageStandard: "c11",
      headerLanguage: "auto",
    },
    buildSystem: "cmake",
    status: "discovered",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export function makeDynamicSession(overrides?: Partial<DynamicAnalysisSession>): DynamicAnalysisSession {
  return {
    id: `dyn-${uuid()}`,
    projectId: `proj-${uuid()}`,
    status: "connected",
    source: { type: "adapter", adapterId: `adapter-${uuid().slice(0, 8)}`, adapterName: "Test Adapter" },
    messageCount: 0,
    alertCount: 0,
    startedAt: now(),
    ...overrides,
  };
}

export function makeDynamicAlert(overrides?: Partial<DynamicAlert>): DynamicAlert {
  return {
    id: `alert-${uuid()}`,
    severity: "medium",
    title: "Test Alert",
    description: "Test alert description",
    relatedMessages: [],
    detectedAt: now(),
    ...overrides,
  };
}

export function makeCanMessage(overrides?: Partial<CanMessage>): CanMessage {
  return {
    timestamp: now(),
    id: "0x7E0",
    dlc: 8,
    data: "02 01 00 00 00 00 00 00",
    flagged: false,
    ...overrides,
  };
}

export function makeDynamicTestResult(overrides?: Partial<DynamicTestResult>): DynamicTestResult {
  return {
    id: `test-${uuid()}`,
    projectId: `proj-${uuid()}`,
    config: {
      testType: "fuzzing",
      strategy: "random",
      targetEcu: "ECM",
      protocol: "UDS",
      targetId: "0x7E0",
      count: 10,
    },
    status: "completed",
    totalRuns: 10,
    crashes: 0,
    anomalies: 0,
    findings: [],
    createdAt: now(),
    ...overrides,
  };
}

export function makeNotification(overrides?: Partial<Notification>): Notification {
  return {
    id: `notif-${uuid()}`,
    projectId: `proj-${uuid()}`,
    type: "analysis_complete",
    title: "Test Notification",
    body: "Test notification body",
    read: false,
    createdAt: now(),
    ...overrides,
  };
}

export function makeUser(overrides?: Partial<User>): User {
  return {
    id: `user-${uuid().slice(0, 8)}`,
    username: `testuser-${uuid().slice(0, 6)}`,
    displayName: "Test User",
    role: "analyst",
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}
