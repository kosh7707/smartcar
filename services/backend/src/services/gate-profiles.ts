/**
 * 사전정의 Gate 프로필 — sdk-profiles.ts 패턴 동일
 *
 * 프로젝트별로 gate 프로필을 선택하여 평가 규칙을 조정할 수 있다.
 * 프로필 미지정 시 "default" 사용 (현재 하드코딩과 동일한 동작).
 */
import type { GateProfile } from "@aegis/shared";

export const GATE_PROFILES: GateProfile[] = [
  {
    id: "default",
    name: "기본 (Default)",
    description: "모든 규칙 적용, high ≥ 5 warning",
    rules: [
      { ruleId: "no-critical", enabled: true },
      { ruleId: "high-threshold", enabled: true, params: { threshold: 5 } },
      { ruleId: "evidence-coverage", enabled: true },
      { ruleId: "sandbox-unreviewed", enabled: true },
    ],
  },
  {
    id: "strict",
    name: "엄격 (Strict)",
    description: "모든 규칙 적용, high ≥ 3 warning (낮은 임계값)",
    rules: [
      { ruleId: "no-critical", enabled: true },
      { ruleId: "high-threshold", enabled: true, params: { threshold: 3 } },
      { ruleId: "evidence-coverage", enabled: true },
      { ruleId: "sandbox-unreviewed", enabled: true },
    ],
  },
  {
    id: "relaxed",
    name: "완화 (Relaxed)",
    description: "critical만 차단, 나머지 규칙 비활성",
    rules: [
      { ruleId: "no-critical", enabled: true },
      { ruleId: "high-threshold", enabled: false },
      { ruleId: "evidence-coverage", enabled: false },
      { ruleId: "sandbox-unreviewed", enabled: false },
    ],
  },
];

export function findGateProfile(id: string): GateProfile | undefined {
  return GATE_PROFILES.find((p) => p.id === id);
}

export const DEFAULT_GATE_PROFILE_ID = "default";
