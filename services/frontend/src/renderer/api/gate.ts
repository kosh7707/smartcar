import { apiFetch } from "./core";

/* ── Types ── */

export type GateStatus = "pass" | "fail" | "warning";
export type GateRuleId = "no-critical" | "high-threshold" | "evidence-coverage" | "sandbox-unreviewed";

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
    approvalId?: string;
    overriddenAt: string;
  };
  createdAt: string;
}

/* ── API ── */

export async function fetchProjectGates(projectId: string): Promise<GateResult[]> {
  const res = await apiFetch<{ success: boolean; data: GateResult[] }>(
    `/api/projects/${projectId}/gates`,
  );
  return res.data;
}

export async function fetchGateDetail(gateId: string): Promise<GateResult> {
  const res = await apiFetch<{ success: boolean; data: GateResult }>(
    `/api/gates/${gateId}`,
  );
  return res.data;
}

export async function overrideGate(
  gateId: string,
  reason: string,
  actor?: string,
): Promise<void> {
  await apiFetch(`/api/gates/${gateId}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, actor }),
  });
}
