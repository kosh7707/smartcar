import React from "react";
import {
  AlertCircle,
  AlertOctagon,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  GitBranch,
  Shield,
  Timer,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApprovalRequest } from "../../../api/approval";
import { formatDateTime } from "../../../utils/format";
import type { ApprovalDecisionAction, ApprovalFilterStatus } from "../hooks/useApprovalsPage";

type ApprovalStatusConfig = {
  icon: React.ReactNode;
  label: string;
};

const STATUS_CONFIG: Record<Exclude<ApprovalFilterStatus, "all">, ApprovalStatusConfig> = {
  pending: { icon: <Clock size={12} />, label: "대기" },
  approved: { icon: <CheckCircle size={12} />, label: "승인됨" },
  rejected: { icon: <XCircle size={12} />, label: "거부" },
  expired: { icon: <Timer size={12} />, label: "만료" },
};

const ACTION_LABELS: Record<string, string> = {
  "gate.override": "Quality Gate 오버라이드",
  "finding.accepted_risk": "Finding 위험 수용",
};

const ACTION_EYEBROW: Record<string, string> = {
  "gate.override": "GATE OVERRIDE",
  "finding.accepted_risk": "ACCEPTED RISK",
};

interface ApprovalRequestListProps {
  approvals: ApprovalRequest[];
  filter: ApprovalFilterStatus;
  onOpenTarget: (approval: ApprovalRequest) => void;
  onStartDecision: (approvalId: string, action: ApprovalDecisionAction) => void;
}

export const ApprovalRequestList: React.FC<ApprovalRequestListProps> = ({
  approvals,
  filter,
  onOpenTarget,
  onStartDecision,
}) => {
  if (approvals.length === 0) {
    const isAll = filter === "all";
    const heading = isAll
      ? "승인 요청이 없습니다"
      : `${STATUS_CONFIG[filter]?.label ?? filter} 상태의 요청이 없습니다`;

    return (
      <section className="chore c-3 approvals-empty-wrap" aria-labelledby="approvals-empty-head">
        <div className="section-head">
          <h2 id="approvals-empty-head">{heading}</h2>
          <span className="hint">{isAll ? "AWAITING APPROVAL" : "NO MATCHES"}</span>
        </div>
        <div className={cn("panel approvals-empty-panel", !isAll && "approvals-empty-panel--filtered")}>
          <span className="approvals-empty-panel__accent" aria-hidden="true" />
          <div className="approvals-empty-panel__lead">
            <div className="approvals-empty-panel__eyebrow-row">
              <span className="approvals-empty-panel__eyebrow">
                {isAll ? "NOTHING YET" : "FILTERED OUT"}
              </span>
              {isAll && (
                <span className="approvals-empty-panel__standby">
                  <span className="approvals-empty-panel__standby-dot" aria-hidden="true" />
                  REVIEWER STANDING BY
                </span>
              )}
            </div>
            <p className="approvals-empty-panel__headline">
              {isAll
                ? "Gate 예외 승인과 위험 수용 요청을 받으면 이 곳에 쌓입니다."
                : "이 필터 조건에 해당하는 요청이 없습니다."}
            </p>
            <p className="approvals-empty-panel__caption">
              {isAll
                ? "요청 발생 시 심사 · 승인 · 거부 이력과 감사 로그가 자동으로 기록됩니다."
                : "전체 탭에서 모든 승인 요청을 확인할 수 있습니다."}
            </p>
          </div>

          {isAll && (
            <>
              <dl className="approvals-empty-panel__preview" aria-label="승인 큐 항목 미리보기">
                <div className="approvals-empty-panel__preview-cell">
                  <Shield size={14} className="approvals-empty-panel__preview-icon" aria-hidden="true" />
                  <dt>Gate 오버라이드</dt>
                  <dd>품질 게이트 예외 요청</dd>
                </div>
                <div className="approvals-empty-panel__preview-cell">
                  <AlertOctagon size={14} className="approvals-empty-panel__preview-icon" aria-hidden="true" />
                  <dt>위험 수용</dt>
                  <dd>Finding · accepted_risk</dd>
                </div>
                <div className="approvals-empty-panel__preview-cell">
                  <GitBranch size={14} className="approvals-empty-panel__preview-icon" aria-hidden="true" />
                  <dt>결정 흐름</dt>
                  <dd>PENDING → APPROVED / REJECTED</dd>
                </div>
                <div className="approvals-empty-panel__preview-cell">
                  <FileText size={14} className="approvals-empty-panel__preview-icon" aria-hidden="true" />
                  <dt>감사 로그</dt>
                  <dd>decidedBy · ts · 코멘트</dd>
                </div>
              </dl>

              <div className="approvals-empty-panel__wireframes" aria-hidden="true">
                <span className="approvals-empty-panel__wireframes-label">
                  SHAPE OF A REAL REQUEST
                </span>
                <div className="approvals-empty-panel__wireframe-stack">
                  <article className="approval-card approval-card--pending approvals-empty-panel__ghost">
                    <span className="approval-card__line" aria-hidden="true" />
                    <div className="approval-card__body">
                      <header className="approval-card__head">
                        <div className="approval-card__head-main">
                          <span className="approval-card__kind">GATE OVERRIDE</span>
                          <span className="approvals-empty-panel__skel approvals-empty-panel__skel--title" />
                          <div className="approval-card__meta">
                            <span className="approvals-empty-panel__skel approvals-empty-panel__skel--xs" />
                            <span className="sep" aria-hidden="true">·</span>
                            <span className="approvals-empty-panel__skel approvals-empty-panel__skel--sm" />
                            <span className="sep" aria-hidden="true">·</span>
                            <span className="approvals-empty-panel__skel approvals-empty-panel__skel--sm" />
                          </div>
                        </div>
                        <span className="approval-status approval-status--pending">
                          <span className="approval-status__dot" />
                          대기
                        </span>
                      </header>
                      <div className="approval-card__reason">
                        <span className="approvals-empty-panel__skel approvals-empty-panel__skel--block" />
                      </div>
                    </div>
                  </article>
                  <article className="approval-card approval-card--approved approvals-empty-panel__ghost">
                    <span className="approval-card__line" aria-hidden="true" />
                    <div className="approval-card__body">
                      <header className="approval-card__head">
                        <div className="approval-card__head-main">
                          <span className="approval-card__kind">ACCEPTED RISK</span>
                          <span className="approvals-empty-panel__skel approvals-empty-panel__skel--title" />
                          <div className="approval-card__meta">
                            <span className="approvals-empty-panel__skel approvals-empty-panel__skel--xs" />
                            <span className="sep" aria-hidden="true">·</span>
                            <span className="approvals-empty-panel__skel approvals-empty-panel__skel--sm" />
                          </div>
                        </div>
                        <span className="approval-status approval-status--approved">
                          <span className="approval-status__dot" />
                          승인됨
                        </span>
                      </header>
                      <footer className="approval-card__decision">
                        <span className="approval-card__decision-key">DECISION</span>
                        <span className="approvals-empty-panel__skel approvals-empty-panel__skel--sm" />
                      </footer>
                    </div>
                  </article>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="chore c-3 approval-list" aria-label="승인 요청 목록">
      <div className="approval-list__rows">
        {approvals.map((approval) => {
          const st = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.pending;
          const isExpired = new Date(approval.expiresAt) < new Date();
          const isPending = approval.status === "pending";
          const isImminent =
            new Date(approval.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

          return (
            <article
              key={approval.id}
              className={cn("approval-card", `approval-card--${approval.status}`)}
            >
              <span className="approval-card__line" aria-hidden="true" />
              <div className="approval-card__body">
                <header className="approval-card__head">
                  <div className="approval-card__head-main">
                    <span className="approval-card__kind">
                      {ACTION_EYEBROW[approval.actionType] ?? approval.actionType.toUpperCase()}
                    </span>
                    <h3 className="approval-card__title">
                      {ACTION_LABELS[approval.actionType] ?? approval.actionType}
                    </h3>
                    <div className="approval-card__meta">
                      <span>
                        <b className="approval-card__meta-key">REQ</b>
                        {approval.requestedBy}
                      </span>
                      <span className="sep" aria-hidden="true">·</span>
                      <span>{formatDateTime(approval.createdAt)}</span>
                      {!isExpired && isPending && (
                        <>
                          <span className="sep" aria-hidden="true">·</span>
                          <span
                            className={cn(
                              isImminent && "approval-card__expires-soon",
                            )}
                          >
                            <b className="approval-card__meta-key">EXP</b>
                            {formatDateTime(approval.expiresAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "approval-status",
                      `approval-status--${approval.status}`,
                    )}
                  >
                    <span className="approval-status__dot" aria-hidden="true" />
                    {st.icon}
                    {st.label}
                  </span>
                </header>

                <div className="approval-card__reason">
                  <AlertCircle size={14} aria-hidden="true" />
                  <p>{approval.reason}</p>
                </div>

                <div className="approval-card__actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm approval-card__link"
                    onClick={() => onOpenTarget(approval)}
                  >
                    <ExternalLink size={14} />
                    {approval.actionType === "gate.override" ? "Gate 보기" : "Finding 보기"}
                  </button>

                  {isPending && !isExpired && (
                    <div className="approval-card__decision-buttons">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onStartDecision(approval.id, "approved")}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onStartDecision(approval.id, "rejected")}
                      >
                        거부
                      </button>
                    </div>
                  )}
                </div>

                {approval.decision && (
                  <footer className="approval-card__decision">
                    <span className="approval-card__decision-key">DECISION</span>
                    <span className="approval-card__decision-by">
                      결정: {approval.decision.decidedBy} ({formatDateTime(approval.decision.decidedAt)})
                    </span>
                    {approval.decision.comment && (
                      <span className="approval-card__decision-comment">
                        "{approval.decision.comment}"
                      </span>
                    )}
                  </footer>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
