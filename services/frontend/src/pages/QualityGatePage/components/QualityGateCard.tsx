import React from "react";
import { ShieldOff, ExternalLink, GitPullRequest, Info, User } from "lucide-react";
import type { GateProfile } from "@aegis/shared";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";
import {
  STATUS_CONFIG,
  formatRequestedBy,
  sortGateRules,
} from "../qualityGatePresentation";
import { QualityGateRuleResultRow } from "./QualityGateRuleResultRow";

type QualityGateCardProps = {
  gate: GateResult;
  profile?: GateProfile;
  onRequestOverride: (gateId: string) => void;
};

export function QualityGateCard({ gate, profile, onRequestOverride }: QualityGateCardProps) {
  const config = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.warning;
  const failedCount = gate.rules.filter((rule) => rule.result === "failed").length;
  const sortedRules = [...gate.rules].sort(sortGateRules);
  const ruleCount = gate.rules.length;
  const isOverridden = !!gate.override;
  const cardStateClass =
    config.gateMod === "blocked"
      ? "is-fail"
      : config.gateMod === "warn"
        ? "is-warn"
        : config.gateMod === "pass"
          ? "is-pass"
          : "is-running";
  const requestedByLabel = formatRequestedBy(gate.requestedBy ?? undefined);
  const profileLabel = profile?.name ?? gate.profileId ?? null;
  const dim = (label: string) => (
    <span className="gate-card__placeholder" aria-label={label}>
      —
    </span>
  );

  return (
    <article className={`gate-card quality-gate-card ${cardStateClass}`}>
      <div className="gate-card__shoulder" aria-hidden="true" />

      <header className="gate-card__head">
        <div className="gate-card__head-title">
          <div className="gate-card__title-row">
            <span
              className={`gate ${config.gateMod}`}
              aria-label={`게이트 상태 ${config.label}`}
            >
              {isOverridden ? "오버라이드됨" : config.label}
            </span>
            <h3 className="gate-card__title">SAST · 정적 분석 게이트</h3>
            {profileLabel ? (
              <span className="gate-card__profile" title="정책 프로필">
                {profileLabel}
              </span>
            ) : null}
          </div>
          <dl className="gate-card__meta">
            <div className="gate-card__meta-row">
              <dt>RUN</dt>
              <dd>#{gate.runId}</dd>
            </div>
            <div className="gate-card__meta-row">
              <dt>COMMIT</dt>
              <dd>{gate.commit ? <span className="mono">{gate.commit.slice(0, 7)}</span> : dim("commit 미공급")}</dd>
            </div>
            <div className="gate-card__meta-row">
              <dt>BRANCH</dt>
              <dd>{gate.branch ?? dim("branch 미공급")}</dd>
            </div>
            <div className="gate-card__meta-row">
              <dt>
                <User aria-hidden="true" /> 요청자
              </dt>
              <dd>{requestedByLabel ?? dim("requestedBy 미공급")}</dd>
            </div>
          </dl>
          <p className="gate-card__rule-summary">
            <span>규칙 {ruleCount}건</span>
          </p>
        </div>

        <div className="gate-card__head-aside">
          <time className="gate-card__time">{formatDateTime(gate.evaluatedAt)}</time>
        </div>
      </header>

      {gate.override && (
        <div className="gate-override-notice" role="status">
          <ShieldOff aria-hidden="true" />
          <div className="gate-override-notice__copy">
            <span className="gate-override-notice__title">
              Override Active · 실패 규칙 무시됨
            </span>
            <p className="gate-override-notice__reason">{gate.override.reason}</p>
            <p className="gate-override-notice__by">
              <span>승인자 {gate.override.overriddenBy}</span>
              <span className="gate-override-notice__sep" aria-hidden="true">·</span>
              <time>{formatDateTime(gate.override.overriddenAt)}</time>
              {gate.override.approvalId ? (
                <>
                  <span className="gate-override-notice__sep" aria-hidden="true">·</span>
                  <span>결정 #{gate.override.approvalId}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      )}

      <div className="gate-card__rules">
        {sortedRules.map((rule) => (
          <QualityGateRuleResultRow key={rule.ruleId} rule={rule} />
        ))}
      </div>

      {gate.status === "fail" && !gate.override && (
        <footer className="gate-card__foot">
          <span className="gate-card__foot-hint">
            <Info aria-hidden="true" />
            <span>차단된 게이트는 머지가 막힙니다. 우회가 필요하면 승인 큐로 요청을 제출하세요.</span>
          </span>
          <button type="button" className="btn btn-outline btn-sm" disabled>
            <GitPullRequest aria-hidden="true" />
            실패 항목 탐색
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm gate-card__override-trigger"
            onClick={() => onRequestOverride(gate.id)}
          >
            <ShieldOff aria-hidden="true" />
            오버라이드 요청
          </button>
        </footer>
      )}

      {failedCount === 0 && !gate.override && gate.status !== "pass" && (
        <footer className="gate-card__foot gate-card__foot--muted">
          <span className="gate-card__foot-hint">
            <ExternalLink aria-hidden="true" />
            <span>경고 항목은 다음 평가까지 모니터링됩니다.</span>
          </span>
        </footer>
      )}
    </article>
  );
}
