import { apiFetch } from "./core";
import type { Severity } from "@aegis/shared";

/* ── Types ── */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalActionType = "gate.override" | "finding.accepted_risk";

/**
 * S2 contract (H4) — backend-populated impact summary. NEVER frontend-derived.
 * historical rows may be absent → render dim placeholder, do not backfill.
 */
export interface ApprovalImpactSummary {
  failedRules: number;
  ignoredFindings: number;
  severityBreakdown?: Record<string, number>;
}

/**
 * S2 contract (H5) — backend-populated target snapshot. NEVER frontend-derived.
 * gate.override → first variant, finding.accepted_risk → second variant.
 * historical rows may be absent → render dim "—" placeholder per row.
 */
export type ApprovalTargetSnapshot =
  | {
      runId: string;
      commit?: string;
      branch?: string;
      profile?: string;
      action?: ApprovalActionType;
    }
  | {
      findingId: string;
      file?: string;
      line?: number;
      severity?: Severity;
    };

export interface ApprovalRequest {
  id: string;
  actionType: ApprovalActionType;
  requestedBy: string;
  targetId: string;
  projectId: string;
  reason: string;
  status: ApprovalStatus;
  impactSummary?: ApprovalImpactSummary;
  targetSnapshot?: ApprovalTargetSnapshot;
  decision?: {
    decidedBy: string;
    decidedAt: string;
    comment?: string;
  };
  expiresAt: string;
  createdAt: string;
}

/* ── API ── */

// TEMP: dev-only mocks for visual review of populated approvals state.
// Remove this block + the early return below when finished.
const DEV_MOCK_APPROVALS_ENABLED = import.meta.env.DEV;
function devMockApprovals(projectId: string): ApprovalRequest[] {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  return [
    {
      id: "APR-3041",
      actionType: "gate.override",
      requestedBy: "kim.analyst",
      targetId: "gate-run-2841",
      projectId,
      reason: "긴급 OTA 핫픽스 — Gate critical 1건이 false positive로 추정. 다음 릴리즈 전까지 임시 통과 요청.",
      status: "pending",
      impactSummary: {
        failedRules: 2,
        ignoredFindings: 7,
        severityBreakdown: { critical: 1, high: 4, medium: 2 },
      },
      targetSnapshot: {
        runId: "2841",
        commit: "a4f8c1d",
        branch: "release/2026.04",
        profile: "prod-strict-v3",
        action: "gate.override",
      },
      expiresAt: iso(12 * HOUR),
      createdAt: iso(-6 * HOUR),
    },
    {
      id: "APR-3040",
      actionType: "gate.override",
      requestedBy: "park.lead",
      targetId: "gate-run-2840",
      projectId,
      reason: "CAN-FD 게이트웨이 보안 검사 — 신규 ECU 추가 시 일시적으로 strict 프로파일 위반. 검증 완료 후 다음 빌드에서 통과 예정.",
      status: "pending",
      impactSummary: {
        failedRules: 1,
        ignoredFindings: 3,
        severityBreakdown: { critical: 1, medium: 2 },
      },
      targetSnapshot: {
        runId: "2840",
        commit: "c9b3e2a",
        branch: "feature/can-fd-ecu",
        profile: "prod-strict-v3",
        action: "gate.override",
      },
      expiresAt: iso(20 * HOUR),
      createdAt: iso(-3 * HOUR),
    },
    {
      id: "APR-3038",
      actionType: "finding.accepted_risk",
      requestedBy: "park.dev",
      targetId: "finding-9714",
      projectId,
      reason: "외부 라이브러리(libcurl) 내부 SAST 탐지 — 현재 버전 정책상 업그레이드 불가. 다음 분기 마이그레이션 시 재평가.",
      status: "pending",
      impactSummary: {
        failedRules: 1,
        ignoredFindings: 1,
        severityBreakdown: { high: 1 },
      },
      targetSnapshot: {
        findingId: "9714",
        file: "third_party/libcurl/lib/sendf.c",
        line: 412,
        severity: "high",
      },
      expiresAt: iso(5 * DAY),
      createdAt: iso(-3 * DAY),
    },
    {
      id: "APR-3035",
      actionType: "gate.override",
      requestedBy: "lee.eng",
      targetId: "gate-run-2835",
      projectId,
      reason: "테스트 커버리지 임계 미달 (78.4% / 목표 80%) — 단위 테스트 1건 unstable. 후속 PR 에서 보강 예정.",
      status: "pending",
      impactSummary: {
        failedRules: 1,
        ignoredFindings: 0,
        severityBreakdown: {},
      },
      targetSnapshot: {
        runId: "2835",
        commit: "1f7d8a2",
        branch: "release/2026.04",
        profile: "prod-strict-v3",
        action: "gate.override",
      },
      expiresAt: iso(2.5 * DAY),
      createdAt: iso(-1.5 * DAY),
    },
    {
      id: "APR-3032",
      actionType: "finding.accepted_risk",
      requestedBy: "choi.review",
      targetId: "finding-9682",
      projectId,
      reason: "오픈소스 의존성 정책 예외 — OWASP Top10 회귀 검사 통과 확인. 라이선스 정책 위원회 승인 후 운영 적용.",
      status: "pending",
      impactSummary: {
        failedRules: 1,
        ignoredFindings: 2,
        severityBreakdown: { medium: 2 },
      },
      targetSnapshot: {
        findingId: "9682",
        file: "src/security/dependency_check.rs",
        line: 87,
        severity: "medium",
      },
      expiresAt: iso(7 * DAY),
      createdAt: iso(-5 * HOUR),
    },
    {
      id: "APR-3025",
      actionType: "gate.override",
      requestedBy: "lee.lead",
      targetId: "gate-run-2789",
      projectId,
      reason: "테스트 커버리지 임계 미달 (78.4% / 목표 80%) — 단위 테스트 1건 unstable. 후속 PR 에서 보강 예정.",
      status: "approved",
      decision: {
        decidedBy: "admin",
        decidedAt: iso(-1 * DAY),
        comment: "후속 PR 내 보강 확인. 다음 릴리즈에 다시 평가.",
      },
      impactSummary: {
        failedRules: 1,
        ignoredFindings: 0,
        severityBreakdown: {},
      },
      targetSnapshot: {
        runId: "2789",
        commit: "9b2e4f0",
        branch: "main",
        profile: "prod-strict-v3",
        action: "gate.override",
      },
      expiresAt: iso(-1 * DAY),
      createdAt: iso(-2 * DAY),
    },
    {
      id: "APR-3022",
      actionType: "finding.accepted_risk",
      requestedBy: "kim.security",
      targetId: "finding-9540",
      projectId,
      reason: "ISO 26262 ASIL-D 정책 예외 — 검토위원회 합의. 차기 분기 fix 일정에 포함.",
      status: "approved",
      decision: {
        decidedBy: "review.committee",
        decidedAt: iso(-2 * DAY),
        comment: "정책 위원회 회의록 #2026-04-22 참조.",
      },
      impactSummary: {
        failedRules: 1,
        ignoredFindings: 1,
        severityBreakdown: { high: 1 },
      },
      targetSnapshot: {
        findingId: "9540",
        file: "src/safety/asil_check.c",
        line: 234,
        severity: "high",
      },
      expiresAt: iso(-2 * DAY),
      createdAt: iso(-4 * DAY),
    },
    {
      id: "APR-3018",
      actionType: "gate.override",
      requestedBy: "han.dev",
      targetId: "gate-run-2755",
      projectId,
      reason: "회귀 테스트 부족 — 새로운 통신 모듈 도입에 대한 검증 미흡. 통과 거부.",
      status: "rejected",
      decision: {
        decidedBy: "admin",
        decidedAt: iso(-3 * DAY),
        comment: "회귀 테스트 보강 후 재요청 부탁드립니다.",
      },
      impactSummary: {
        failedRules: 3,
        ignoredFindings: 4,
        severityBreakdown: { critical: 2, high: 2 },
      },
      targetSnapshot: {
        runId: "2755",
        commit: "5e1c903",
        branch: "feature/comm-redesign",
        profile: "prod-strict-v3",
        action: "gate.override",
      },
      expiresAt: iso(-3 * DAY),
      createdAt: iso(-4 * DAY),
    },
    {
      id: "APR-3015",
      actionType: "finding.accepted_risk",
      requestedBy: "song.qa",
      targetId: "finding-9421",
      projectId,
      reason: "결정 없이 만료 — 응답 기한 내 검토자 의사 결정 부재.",
      status: "expired",
      expiresAt: iso(-2 * DAY),
      createdAt: iso(-9 * DAY),
    },
    {
      id: "APR-3010",
      actionType: "gate.override",
      requestedBy: "yoon.cert",
      targetId: "gate-run-2698",
      projectId,
      reason: "ISO 26262 ASIL-D 부분 충족 검증 — 외부 인증기관 audit 통과. 임시 운영 승인.",
      status: "approved",
      decision: {
        decidedBy: "admin",
        decidedAt: iso(-6 * DAY),
        comment: "TUV 인증서 첨부 확인. 다음 audit 까지 유효.",
      },
      impactSummary: {
        failedRules: 2,
        ignoredFindings: 5,
        severityBreakdown: { high: 3, medium: 2 },
      },
      targetSnapshot: {
        runId: "2698",
        commit: "8fa5b21",
        branch: "release/2026.03",
        profile: "prod-strict-v3",
        action: "gate.override",
      },
      expiresAt: iso(-6 * DAY),
      createdAt: iso(-8 * DAY),
    },
  ];
}

export async function fetchProjectApprovals(projectId: string): Promise<ApprovalRequest[]> {
  if (DEV_MOCK_APPROVALS_ENABLED) return devMockApprovals(projectId);
  const res = await apiFetch<{ success: boolean; data: ApprovalRequest[] }>(
    `/api/projects/${projectId}/approvals`,
  );
  return res.data;
}

export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  actor?: string,
  comment?: string,
): Promise<ApprovalRequest> {
  const res = await apiFetch<{ success: boolean; data: ApprovalRequest }>(
    `/api/approvals/${approvalId}/decide`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, actor, comment }),
    },
  );
  return res.data;
}

export async function fetchApprovalCount(projectId: string): Promise<{ pending: number; total: number }> {
  const res = await apiFetch<{ success: boolean; data: { pending: number; total: number } }>(
    `/api/projects/${projectId}/approvals/count`,
  );
  return res.data;
}
