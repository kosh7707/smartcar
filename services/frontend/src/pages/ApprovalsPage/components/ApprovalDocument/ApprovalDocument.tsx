import "./ApprovalDocument.css";
import React, { useEffect, useState } from "react";
import type { ApprovalRequest } from "@/common/api/approval";
import { formatDateTime } from "@/common/utils/format";
import type { ApprovalDecisionAction } from "../../useApprovalsPageController";
import {
  ACTION_LABELS,
  STATUS_LABELS,
  buildTargetSnapshotRows,
  formatImpactSummary,
} from "../../approvalPresentation";
import {
  formatLeftLong,
  formatRelative,
  paragraphsFromReason,
} from "../../approvalFormat";

const DECISION_VERB: Record<ApprovalRequest["status"], string> = {
  pending: "님이 결정",
  approved: "님이 승인",
  rejected: "님이 거부",
  expired: "님의 결정 기록",
};

interface Props {
  approval: ApprovalRequest | null;
  decidingId: string | null;
  onOpenTarget: (approval: ApprovalRequest) => void;
  onDecide: (id: string, action: ApprovalDecisionAction, comment: string) => void | Promise<void>;
}

export const ApprovalDocument: React.FC<Props> = ({
  approval,
  decidingId,
  onOpenTarget,
  onDecide,
}) => {
  if (!approval) {
    return (
      <section
        className="appr-doc"
        id="appr-doc"
        role="tabpanel"
        aria-label="선택된 요청 없음"
      >
        <div className="appr-doc__empty">
          <h3>선택된 요청이 없습니다</h3>
          <p>왼쪽에서 항목을 선택하세요.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="appr-doc"
      id="appr-doc"
      role="tabpanel"
      aria-labelledby={`appr-rail-tab-${approval.id}`}
    >
      <DocumentBody
        approval={approval}
        decidingId={decidingId}
        onOpenTarget={onOpenTarget}
        onDecide={onDecide}
      />
    </section>
  );
};

interface BodyProps {
  approval: ApprovalRequest;
  decidingId: string | null;
  onOpenTarget: (approval: ApprovalRequest) => void;
  onDecide: (id: string, action: ApprovalDecisionAction, comment: string) => void | Promise<void>;
}

function DocumentBody({ approval, decidingId, onOpenTarget, onDecide }: BodyProps) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    setComment("");
  }, [approval.id]);

  const expiresMs = new Date(approval.expiresAt).getTime();
  const deltaMs = expiresMs - Date.now();
  const isExpired = deltaMs <= 0;
  const isPending = approval.status === "pending";
  const slaWarn = isPending && deltaMs > 0 && deltaMs <= 8 * 60 * 60 * 1000;
  const isProcessing = decidingId === approval.id;
  const canDecide = isPending && !isExpired;

  const targetRows = buildTargetSnapshotRows(approval.targetSnapshot, approval.actionType);
  const visibleTargetRows = targetRows.filter((row) => row.value !== null);
  const targetLabel =
    approval.actionType === "gate.override" ? "Gate 결과 보기" : "Finding 보기";
  const reasonParagraphs = paragraphsFromReason(approval.reason);
  const impactText = formatImpactSummary(approval.impactSummary);
  const findings = approval.findings ?? [];
  const discussion = approval.discussion ?? [];

  const sevSummary = (() => {
    if (findings.length === 0) return null;
    const counts = findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {});
    return (["critical", "high", "medium", "low", "info"] as const)
      .filter((k) => counts[k])
      .map((k) => `${k} ${counts[k]}`)
      .join(" · ");
  })();

  return (
    <>
      <header className="appr-doc__head">
        <div className="appr-doc__eyebrow">
          <span className="id">{approval.id}</span>
          <span className="sep" aria-hidden="true">·</span>
          <span className={`appr-doc__status s-${approval.status}`}>
            <span className="dot" aria-hidden="true" />
            {STATUS_LABELS[approval.status]}
          </span>
          {isPending && !isExpired ? (
            <>
              <span className="sep" aria-hidden="true">·</span>
              <span>{formatRelative(approval.createdAt)} 제출</span>
            </>
          ) : null}
        </div>
        <h2 className="appr-doc__title">
          {ACTION_LABELS[approval.actionType] ?? approval.actionType}
        </h2>
        {visibleTargetRows.length > 0 ? (
          <div className="appr-doc__meta">
            {visibleTargetRows.map((row, i) => (
              <React.Fragment key={row.key}>
                {i > 0 ? <span className="sep" aria-hidden="true">·</span> : null}
                <span className="item">
                  <span className="lbl">{row.label}</span>{" "}
                  <span className="v mono">{row.value}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </header>

      <div className="appr-doc__section">
        <div className="appr-doc__h">
          {approval.actionType === "gate.override"
            ? "게이트가 막은 항목"
            : "관련 발견 항목"}
          {findings.length > 0 ? <span className="count">{findings.length}</span> : null}
        </div>
        {findings.length > 0 ? (
          <>
            <div className="appr-findings">
              {findings.map((f) => (
                <div className="appr-finding" key={f.id}>
                  <div className={`appr-finding__sev s-${f.severity}`}>{f.severity}</div>
                  <div className="appr-finding__rule">
                    <span className="tool">{f.tool}</span>
                    {f.rule}
                  </div>
                  <div className="appr-finding__loc">
                    {f.file}
                    <span className="colon">:</span>
                    {f.line}
                  </div>
                </div>
              ))}
            </div>
            <div className="appr-findings__summary">
              총 <span className="num">{findings.length}</span>건
              {sevSummary ? ` — ${sevSummary}` : null}
            </div>
          </>
        ) : impactText ? (
          <div className="appr-findings__summary">{impactText}</div>
        ) : (
          <div className="appr-findings__missing">
            상세 항목이 첨부되지 않았습니다.
          </div>
        )}
      </div>

      <div className="appr-doc__section">
        <div className="appr-doc__h">요청자의 사유</div>
        <div className="appr-reason">
          <div className="appr-reason__byline">
            <span className="appr-reason__who">{approval.requestedBy}</span>
            {approval.requestedByRole ? (
              <span className="appr-reason__role">· {approval.requestedByRole}</span>
            ) : null}
            <span className="appr-reason__sep" aria-hidden="true">·</span>
            <span className="appr-reason__when">
              {formatRelative(approval.createdAt)} ({formatDateTime(approval.createdAt)})
            </span>
          </div>
          <div className="appr-reason__body">
            {reasonParagraphs.length > 0 ? (
              reasonParagraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>{approval.reason}</p>
            )}
          </div>
        </div>
        <div className="appr-doc__scope">
          <span className="item">
            <span className="lbl">요청 범위</span>
            <span className="v">{approval.actionType}</span>
          </span>
          {isPending && !isExpired ? (
            <span className="item">
              <span className="lbl">유효 기간</span>
              <span className="v">{formatLeftLong(deltaMs)} 후 만료</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="appr-doc__section">
        <div className="appr-doc__h">만료 시각</div>
        <div
          className={`appr-sla${slaWarn ? " is-warn" : ""}${
            isExpired ? " is-expired" : ""
          }`}
        >
          <span className="appr-sla__big">
            {isExpired ? "만료됨" : formatLeftLong(deltaMs)}
          </span>
          {!isExpired ? <span className="appr-sla__lbl">남음</span> : null}
          <span className="appr-sla__expires">
            — {formatDateTime(approval.expiresAt)}
          </span>
        </div>
      </div>

      <div className="appr-doc__section">
        <div className="appr-doc__h">
          토론
          {discussion.length > 0 ? <span className="count">{discussion.length}</span> : null}
        </div>
        {discussion.length === 0 ? (
          <div className="appr-thread__empty">코멘트 없음.</div>
        ) : (
          <div className="appr-thread">
            {discussion.map((entry, i) => (
              <div className="appr-thread__msg" key={i}>
                <div className="appr-thread__byline">
                  <span className="appr-thread__who">{entry.who}</span>
                  {entry.whoRole ? (
                    <span className="appr-thread__role">· {entry.whoRole}</span>
                  ) : null}
                  <span className="appr-thread__sep" aria-hidden="true">·</span>
                  <span className="appr-thread__when">{entry.when}</span>
                </div>
                <div className="appr-thread__body">{entry.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {approval.decision ? (
        <div className="appr-doc__section">
          <div className="appr-doc__h">결정</div>
          <blockquote className={`appr-doc__decision-quote s-${approval.status}`}>
            <p className="appr-doc__decision-attr">
              <span className="appr-doc__decision-by">{approval.decision.decidedBy}</span>
              {DECISION_VERB[approval.status]}
              <span aria-hidden="true"> · </span>
              <span>{formatDateTime(approval.decision.decidedAt)}</span>
            </p>
            {approval.decision.comment ? (
              <p className="appr-doc__decision-comment">
                "{approval.decision.comment}"
              </p>
            ) : null}
          </blockquote>
        </div>
      ) : null}

      <div className="appr-doc__section">
        <div className="appr-doc__h">연관 자료</div>
        <div className="appr-doc__related">
          <button type="button" onClick={() => onOpenTarget(approval)}>
            {targetLabel}
          </button>
        </div>
      </div>

      {canDecide ? (
        <div className="appr-doc__decide">
          <div className="appr-doc__decide-inner">
            <div className="appr-doc__decide-h">결정</div>
            <label className="appr-doc__decide-label" htmlFor="appr-decide-comment">
              결정 사유
              <span className="opt">선택 · 거부 시 권장</span>
            </label>
            <textarea
              id="appr-decide-comment"
              className="appr-doc__decide-textarea"
              placeholder="감사 추적용 메모. 작성한 내용은 그대로 감사 보고서에 기록됩니다."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
            />
            <div className="appr-doc__decide-bar">
              <div className="appr-doc__decide-sig">
                결정자 <b>로그인 사용자</b>
              </div>
              <button
                type="button"
                className="appr-doc__btn appr-doc__btn--reject"
                onClick={() => onDecide(approval.id, "rejected", comment)}
                disabled={isProcessing}
              >
                {isProcessing ? "처리 중..." : "거부"}
              </button>
              <button
                type="button"
                className="appr-doc__btn appr-doc__btn--primary"
                onClick={() => onDecide(approval.id, "approved", comment)}
                disabled={isProcessing}
              >
                {isProcessing ? "처리 중..." : "승인"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
