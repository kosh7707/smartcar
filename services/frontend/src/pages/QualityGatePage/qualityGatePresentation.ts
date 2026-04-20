import type { GateRuleResult, GateResult, GateStatus } from "../../api/gate";

const PASS_BADGE = "quality-gate-badge quality-gate-badge--pass";
const FAIL_BADGE = "quality-gate-badge quality-gate-badge--fail";
const WARNING_BADGE = "quality-gate-badge quality-gate-badge--warning";

type StatusConfig = {
  label: string;
  badgeClassName: string;
  bannerClassName: string;
  accentClassName: string;
};

type RuleResultConfig = {
  label: string;
  badgeClassName: string;
  surfaceClassName: string;
};

export const STATUS_CONFIG: Record<GateStatus, StatusConfig> = {
  pass: {
    label: "통과",
    badgeClassName: PASS_BADGE,
    bannerClassName: "quality-gate-status-banner quality-gate-status-banner--pass",
    accentClassName: "",
  },
  fail: {
    label: "실패",
    badgeClassName: FAIL_BADGE,
    bannerClassName: "quality-gate-status-banner quality-gate-status-banner--fail",
    accentClassName: "",
  },
  warning: {
    label: "경고",
    badgeClassName: WARNING_BADGE,
    bannerClassName: "quality-gate-status-banner quality-gate-status-banner--warning",
    accentClassName: "",
  },
};

export const RULE_RESULT_CONFIG: Record<GateRuleResult["result"], RuleResultConfig> = {
  passed: {
    label: "PASS",
    badgeClassName: PASS_BADGE,
    surfaceClassName: "quality-gate-rule quality-gate-rule--passed",
  },
  failed: {
    label: "FAIL",
    badgeClassName: FAIL_BADGE,
    surfaceClassName: "quality-gate-rule quality-gate-rule--failed",
  },
  warning: {
    label: "WARN",
    badgeClassName: WARNING_BADGE,
    surfaceClassName: "quality-gate-rule quality-gate-rule--warning",
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
