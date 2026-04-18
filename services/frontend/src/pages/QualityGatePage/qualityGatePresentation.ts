import type { GateRuleResult, GateResult, GateStatus } from "../../api/gate";

const PASS_BADGE =
  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200";
const FAIL_BADGE =
  "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200";
const WARNING_BADGE =
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100";

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
    bannerClassName:
      "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/15",
    accentClassName: "border-l-emerald-500",
  },
  fail: {
    label: "실패",
    badgeClassName: FAIL_BADGE,
    bannerClassName:
      "border-red-200/80 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/15",
    accentClassName: "border-l-red-500",
  },
  warning: {
    label: "경고",
    badgeClassName: WARNING_BADGE,
    bannerClassName:
      "border-amber-200/80 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/15",
    accentClassName: "border-l-amber-500",
  },
};

export const RULE_RESULT_CONFIG: Record<GateRuleResult["result"], RuleResultConfig> = {
  passed: {
    label: "PASS",
    badgeClassName: PASS_BADGE,
    surfaceClassName:
      "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/10",
  },
  failed: {
    label: "FAIL",
    badgeClassName: FAIL_BADGE,
    surfaceClassName:
      "border-red-200/80 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/10",
  },
  warning: {
    label: "WARN",
    badgeClassName: WARNING_BADGE,
    surfaceClassName:
      "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/10",
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
