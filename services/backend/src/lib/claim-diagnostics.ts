import type { AgentClaimDiagnosticsSummary } from "@aegis/shared";
import { safeJsonParse } from "./utils";

const SEVERITY_VALUES = new Set(["critical", "high", "medium", "low", "info"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEvidenceTrailEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ["evidenceRef", "evidenceRefId", "refId", "role", "status", "detail"].every((key) => (
    value[key] === undefined || typeof value[key] === "string"
  ));
}

function isRevisionHistoryEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (value.fromStatus === undefined || typeof value.fromStatus === "string")
    && (value.toStatus === undefined || typeof value.toStatus === "string")
    && (value.reason === undefined || typeof value.reason === "string")
    && (value.timestampMs === undefined || typeof value.timestampMs === "number");
}

function isNonAcceptedClaim(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.status === "string"
    && (value.claimId === undefined || typeof value.claimId === "string")
    && (value.family === undefined || typeof value.family === "string")
    && (value.primaryLocation === undefined || typeof value.primaryLocation === "string")
    && (value.rejectionCode === undefined || typeof value.rejectionCode === "string")
    && (value.rejectionReason === undefined || typeof value.rejectionReason === "string")
    && (value.statement === undefined || typeof value.statement === "string")
    && (value.detail === undefined || typeof value.detail === "string")
    && (value.retryCount === undefined || typeof value.retryCount === "number")
    && (value.severity === undefined || (typeof value.severity === "string" && SEVERITY_VALUES.has(value.severity)))
    && (value.requiredEvidence === undefined || isStringArray(value.requiredEvidence))
    && (value.presentEvidence === undefined || isStringArray(value.presentEvidence))
    && (value.missingEvidence === undefined || isStringArray(value.missingEvidence))
    && (value.evidenceTrail === undefined || (Array.isArray(value.evidenceTrail) && value.evidenceTrail.every(isEvidenceTrailEntry)))
    && (value.revisionHistory === undefined || (Array.isArray(value.revisionHistory) && value.revisionHistory.every(isRevisionHistoryEntry)))
    && (value.invalidRefs === undefined || isStringArray(value.invalidRefs))
    && (value.supportingEvidenceRefs === undefined || isStringArray(value.supportingEvidenceRefs))
    && (value.outcomeContribution === undefined || typeof value.outcomeContribution === "string");
}

export function isClaimDiagnosticsSummary(value: unknown): value is AgentClaimDiagnosticsSummary {
  if (!isRecord(value)) return false;

  const lifecycleCounts = value.lifecycleCounts;
  if (lifecycleCounts !== undefined) {
    if (!isRecord(lifecycleCounts)) return false;
    if (!Object.values(lifecycleCounts).every((count) => typeof count === "number" && Number.isFinite(count))) {
      return false;
    }
  }

  const nonAcceptedClaims = value.nonAcceptedClaims;
  return nonAcceptedClaims === undefined
    || (Array.isArray(nonAcceptedClaims) && nonAcceptedClaims.every(isNonAcceptedClaim));
}

export function parseClaimDiagnostics(raw: string | null): AgentClaimDiagnosticsSummary | undefined {
  const parsed = safeJsonParse<unknown>(raw, undefined);
  return toValidClaimDiagnostics(parsed);
}

export function toValidClaimDiagnostics(value: unknown): AgentClaimDiagnosticsSummary | undefined {
  return isClaimDiagnosticsSummary(value) ? value : undefined;
}

export function assertValidClaimDiagnostics(value: AgentClaimDiagnosticsSummary): AgentClaimDiagnosticsSummary {
  if (!isClaimDiagnosticsSummary(value)) {
    throw new Error("Invalid claimDiagnostics shape");
  }
  return value;
}
