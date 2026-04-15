import type { GateRuleResult, GateResult } from "../../api/gate";

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pass: { label: "통과", className: "gate-status--pass" },
  fail: { label: "실패", className: "gate-status--fail" },
  warning: { label: "경고", className: "gate-status--cds-support-warning" },
};

export const RULE_INFO: Record<string, { label: string; description: string }> = {
  "no-critical": { label: "치명 취약점 없음", description: "치명 수준 취약점이 0건이어야 합니다" },
  "high-threshold": { label: "높음 취약점 임계치", description: "높음 수준 취약점이 설정된 임계값 이하여야 합니다" },
  "evidence-coverage": { label: "증거 충분성", description: "모든 탐지 항목에 1개 이상의 증적이 연결되어 있어야 합니다" },
  "sandbox-unreviewed": { label: "미검토 항목 없음", description: "보류 상태의 미검토 탐지 항목이 0건이어야 합니다" },
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
