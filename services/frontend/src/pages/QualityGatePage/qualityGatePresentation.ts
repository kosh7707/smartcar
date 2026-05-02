import type {
  AgentQualityOutcome,
} from "@aegis/shared";
import type {
  GateRuleResult,
  GateResult,
  GateStatus,
  GateRuleMetric,
} from "@/common/api/gate";

// QualityGatePage presentation logic — gate-context P3 exception per doctrine §2.2.

type StatusConfig = {
  label: string;
  /** historyLabel — shorter sidebar variant (차단/경고/통과/실행) */
  historyLabel: string;
  /** canonical .gate / .cell-gate modifier — { blocked | warn | pass | running } */
  gateMod: "blocked" | "warn" | "pass" | "running";
};

type RuleResultConfig = {
  label: string;
  /** canonical .cell-gate modifier */
  gateMod: "blocked" | "warn" | "pass" | "running";
};

export const STATUS_CONFIG: Record<GateStatus, StatusConfig> = {
  pass: {
    label: "통과",
    historyLabel: "통과",
    gateMod: "pass",
  },
  fail: {
    label: "실패",
    historyLabel: "차단",
    gateMod: "blocked",
  },
  warning: {
    label: "경고",
    historyLabel: "경고",
    gateMod: "warn",
  },
};

export const RULE_RESULT_CONFIG: Record<GateRuleResult["result"], RuleResultConfig> = {
  passed: {
    label: "PASS",
    gateMod: "pass",
  },
  failed: {
    label: "FAIL",
    gateMod: "blocked",
  },
  warning: {
    label: "WARN",
    gateMod: "warn",
  },
};

export const RULE_INFO: Record<string, { label: string; description: string }> = {
  "no-critical": {
    label: "치명 취약점 없음",
    description: "치명 수준 취약점이 0건이어야 합니다",
  },
  "high-threshold": {
    label: "높음 취약점 임계치",
    description: "높음 수준 취약점이 설정된 임계값 이하여야 합니다",
  },
  "evidence-coverage": {
    label: "증거 충분성",
    description: "모든 탐지 항목에 1개 이상의 증적이 연결되어 있어야 합니다",
  },
  "sandbox-unreviewed": {
    label: "미검토 항목 없음",
    description: "보류 상태의 미검토 탐지 항목이 0건이어야 합니다",
  },
};

const RULE_RESULT_ORDER: Record<GateRuleResult["result"], number> = {
  failed: 0,
  warning: 1,
  passed: 2,
};

export function sortGateRules(a: GateRuleResult, b: GateRuleResult) {
  return (RULE_RESULT_ORDER[a.result] ?? 9) - (RULE_RESULT_ORDER[b.result] ?? 9);
}

export function sortGatesByEvaluatedAt(a: GateResult, b: GateResult) {
  return new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime();
}

// Forward-compat: shared-models §2.6.1 reserves qualityOutcome; absent in v1 gate API.
export function readQualityOutcome(
  gate: GateResult,
): AgentQualityOutcome | undefined {
  const candidate = (gate as GateResult & { qualityOutcome?: unknown }).qualityOutcome;
  if (typeof candidate !== "string") return undefined;
  const known: AgentQualityOutcome[] = [
    "accepted",
    "accepted_with_caveats",
    "rejected",
    "inconclusive",
    "repair_exhausted",
  ];
  return known.includes(candidate as AgentQualityOutcome)
    ? (candidate as AgentQualityOutcome)
    : undefined;
}

// shared-models §6.1.1: top-level fields take priority; meta is the alternate carrier. No self-mapping (handoff §9).
export function resolveRuleMetric(rule: GateRuleResult): GateRuleMetric | undefined {
  if (typeof rule.current === "number" && typeof rule.threshold === "number") {
    return {
      current: rule.current,
      threshold: rule.threshold,
      unit: rule.unit,
    };
  }
  if (rule.meta && typeof rule.meta.current === "number" && typeof rule.meta.threshold === "number") {
    return rule.meta;
  }
  return undefined;
}

function formatMetricValue(value: number, unit?: GateRuleMetric["unit"]): string {
  if (unit === "percent") {
    return `${value}%`;
  }
  return `${value}`;
}

export function formatThresholdCurrent(rule: GateRuleResult): string | null {
  const metric = resolveRuleMetric(rule);
  if (!metric) return null;
  return formatMetricValue(metric.current, metric.unit);
}

export function formatThresholdLimit(rule: GateRuleResult): string | null {
  const metric = resolveRuleMetric(rule);
  if (!metric) return null;
  return `/ ${formatMetricValue(metric.threshold, metric.unit)}`;
}

export function buildHeroSubLine(gate: GateResult): string {
  const fail = gate.rules.filter((r) => r.result === "failed").length;
  const warn = gate.rules.filter((r) => r.result === "warning").length;
  const pass = gate.rules.filter((r) => r.result === "passed").length;
  return `${fail} fail · ${warn} warn · ${pass} pass`;
}

export function buildHeroHeadline(status: GateStatus): string {
  switch (status) {
    case "pass":
      return "이번 평가에서 모든 게이트가 통과되었습니다";
    case "fail":
      return "이번 평가에서 차단 사유가 발견되었습니다";
    default:
      return "이번 평가에서 검토가 필요한 항목이 있습니다";
  }
}

// S2 contract §6.1.1: "system" = auto-evaluation marker.
export function formatRequestedBy(requestedBy: string | undefined): string | null {
  if (!requestedBy) return null;
  if (requestedBy === "system") return "자동 평가";
  return requestedBy;
}

export function sparkBarTone(status: GateStatus): "pass" | "fail" | "warn" {
  if (status === "pass") return "pass";
  if (status === "fail") return "fail";
  return "warn";
}
