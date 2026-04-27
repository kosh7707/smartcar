import React from "react";
import { ShieldOff, AlertOctagon, Clock, ExternalLink } from "lucide-react";
import type { ApprovalRequest } from "../../../api/approval";
import { formatDateTime } from "../../../utils/format";
import type { ApprovalDecisionAction, ApprovalFilterStatus } from "../hooks/useApprovalsPage";
import {
  ACTION_EYEBROW,
  ACTION_LABELS,
  STATUS_LABELS,
  actionKind,
  formatImpactSummary,
} from "./approvalPresentation";

const STATUS_FILTER_LABEL: Record<Exclude<ApprovalFilterStatus, "all">, string> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  expired: "expired",
};

function StatusChip({ status }: { status: ApprovalRequest["status"] }) {
  const label = STATUS_FILTER_LABEL[status] ?? STATUS_FILTER_LABEL.pending;
  return (
    <span className={`approval-status approval-status--${status}`}>
      <span className="approval-status__dot" />
      {label}
    </span>
  );
}

function ActionIcon({ approval }: { approval: ApprovalRequest }) {
  if (approval.actionType === "gate.override") return <ShieldOff aria-hidden="true" />;
  return <AlertOctagon aria-hidden="true" />;
}

interface ApprovalRequestListProps {
  approvals: ApprovalRequest[];
  onOpenTarget: (approval: ApprovalRequest) => void;
  onStartDecision: (approvalId: string, action: ApprovalDecisionAction) => void;
}

// k-override/k-risk severity exceptions per handoff §2.2. No self-mapping (handoff §9).
export const ApprovalRequestList: React.FC<ApprovalRequestListProps> = ({
  approvals,
  onOpenTarget,
  onStartDecision,
}) => {
  return (
    <div className="appr-list" role="list">
      {approvals.map((approval) => {
        const isPending = approval.status === "pending";
        const expiresAtMs = new Date(approval.expiresAt).getTime();
        const isExpired = expiresAtMs < Date.now();
        const isImminent =
          isPending && expiresAtMs - Date.now() <= 24 * 60 * 60 * 1000 && !isExpired;
        const targetLabel =
          approval.actionType === "gate.override" ? "Gate 보기" : "Finding 보기";
        const impactText = formatImpactSummary(approval.impactSummary);

        return (
          <article
            key={approval.id}
            role="listitem"
            className={`appr-row approval-card s-${approval.status} ${actionKind(
              approval.actionType,
            )}${isImminent ? " is-imminent" : ""}`}
            onClick={() => onOpenTarget(approval)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenTarget(approval);
              }
            }}
            tabIndex={0}
            aria-label={`${ACTION_LABELS[approval.actionType] ?? approval.actionType} — ${approval.requestedBy}`}
          >
            <div className="appr-row__rail" aria-hidden="true" />
            <div className="appr-icon" aria-hidden="true">
              <ActionIcon approval={approval} />
            </div>
            <div className="appr-row__meta approval-row__body">
              <div className="appr-titlerow approval-row__head">
                <span className="appr-eyebrow approval-row__eyebrow">
                  <span className="lab">
                    {ACTION_EYEBROW[approval.actionType] ?? approval.actionType.toUpperCase()}
                  </span>
                  <span className="id">{approval.id}</span>
                </span>
                <StatusChip status={approval.status} />
              </div>
              <h3 className="appr-title approval-row__title">
                {ACTION_LABELS[approval.actionType] ?? approval.actionType}
              </h3>
              <p className="appr-reason approval-row__reason">{approval.reason}</p>
              <div className="appr-meta approval-row__meta">
                <span className="mi">
                  <b>REQ</b>
                  {approval.requestedBy}
                </span>
                <span className="mi">
                  <Clock aria-hidden="true" />
                  <b>CREATED</b>
                  {formatDateTime(approval.createdAt)}
                </span>
                {isPending && !isExpired ? (
                  <span className={`mi${isImminent ? " imminent" : ""}`}>
                    <b>EXP</b>
                    {formatDateTime(approval.expiresAt)}
                  </span>
                ) : null}
                <span className="mi">
                  <b>TARGET</b>
                  {approval.targetId}
                </span>
              </div>
              {impactText ? (
                <div className="appr-row__impact" aria-label="결정 영향">
                  <b className="appr-row__impact-key">IMPACT</b>
                  <span className="appr-row__impact-text">{impactText}</span>
                </div>
              ) : (
                <div className="appr-row__impact appr-row__impact--placeholder" aria-label="결정 영향">
                  <b className="appr-row__impact-key">IMPACT</b>
                  <span className="appr-row__impact-placeholder">—</span>
                </div>
              )}
              {approval.decision ? (
                <div className="approval-row__decision">
                  <span className="approval-row__meta-key">DECISION</span>
                  <span className="approval-row__decision-by">
                    {approval.decision.decidedBy} · {formatDateTime(approval.decision.decidedAt)}
                  </span>
                  {approval.decision.comment ? (
                    <span className="approval-row__decision-comment">
                      "{approval.decision.comment}"
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div
              className="appr-end approval-row__actions"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onOpenTarget(approval)}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {targetLabel}
              </button>
              {isPending && !isExpired ? (
                <>
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
                </>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export const APPROVAL_LIST_STATUS_LABELS = STATUS_LABELS;
