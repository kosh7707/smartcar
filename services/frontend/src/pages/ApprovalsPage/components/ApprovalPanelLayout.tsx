import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldOff, AlertOctagon, ExternalLink, Clock } from "lucide-react";
import type { ApprovalRequest } from "../../../api/approval";
import { formatDateTime } from "../../../utils/format";
import type {
  ApprovalDecisionAction,
  ApprovalFilterStatus,
  ApprovalSevenDayStats,
} from "../hooks/useApprovalsPage";
import {
  ACTION_EYEBROW,
  ACTION_LABELS,
  STATUS_LABELS,
  actionKind,
  buildTargetSnapshotRows,
  formatImpactSummary,
} from "./approvalPresentation";

interface ApprovalPanelLayoutProps {
  approvals: ApprovalRequest[];
  filter: ApprovalFilterStatus;
  selectedId: string | null;
  decidingId: string | null;
  hasProject: boolean;
  sevenDayStats: ApprovalSevenDayStats;
  onSelect: (id: string | null) => void;
  onOpenTarget: (approval: ApprovalRequest) => void;
  onDecide: (id: string, action: ApprovalDecisionAction, comment: string) => void | Promise<void>;
}

const EMPTY_TITLE: Record<ApprovalFilterStatus, string> = {
  pending: "처리할 승인 요청이 없습니다",
  approved: "승인된 요청이 없습니다",
  rejected: "거부된 요청이 없습니다",
  expired: "만료된 요청이 없습니다",
  all: "승인 요청이 없습니다",
};

const EMPTY_HINT: Partial<Record<ApprovalFilterStatus, string>> = {
  pending: "Gate 오버라이드 또는 위험 수용 요청이 생성되면 이 자리에 표시됩니다.",
};

function formatHoursPrecise(ms: number | null): string {
  if (ms === null) return "—";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 0.1) return "<0.1h";
  return `${hours.toFixed(1)}h`;
}

function ActionIconNode({ approval }: { approval: ApprovalRequest }) {
  if (approval.actionType === "gate.override") return <ShieldOff aria-hidden="true" />;
  return <AlertOctagon aria-hidden="true" />;
}

function VerdictMini({ status }: { status: ApprovalRequest["status"] }) {
  return (
    <span className={`approval-status approval-status--mini approval-status--${status}`}>
      <span className="approval-status__dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const ApprovalPanelLayout: React.FC<ApprovalPanelLayoutProps> = ({
  approvals,
  filter,
  selectedId,
  decidingId,
  hasProject,
  sevenDayStats,
  onSelect,
  onOpenTarget,
  onDecide,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () =>
      approvals.find((approval) => approval.id === selectedId) ??
      approvals[0] ??
      null,
    [approvals, selectedId],
  );

  useEffect(() => {
    if (approvals.length === 0) {
      if (selectedId !== null) onSelect(null);
      return;
    }
    if (!selectedId || !approvals.some((approval) => approval.id === selectedId)) {
      onSelect(approvals[0]!.id);
    }
  }, [approvals, selectedId, onSelect]);

  const handleListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (approvals.length === 0) return;
      const currentIndex = Math.max(
        0,
        approvals.findIndex((approval) => approval.id === selectedId),
      );
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = approvals[Math.min(approvals.length - 1, currentIndex + 1)];
        if (next) onSelect(next.id);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = approvals[Math.max(0, currentIndex - 1)];
        if (prev) onSelect(prev.id);
      } else if (event.key === "Home") {
        event.preventDefault();
        onSelect(approvals[0]!.id);
      } else if (event.key === "End") {
        event.preventDefault();
        onSelect(approvals[approvals.length - 1]!.id);
      }
    },
    [approvals, onSelect, selectedId],
  );

  const isEmpty = approvals.length === 0;
  const emptyTitle = EMPTY_TITLE[filter] ?? EMPTY_TITLE.all;
  const emptyHint = EMPTY_HINT[filter];

  return (
    <div className="appr-panel-layout">
      <div className="appr-panel-layout__list">
        <div className="appr-panel-layout__list-head">
          <span className="appr-panel-layout__group-label" aria-hidden="true">
            요청 목록
            <span className="c">{approvals.length}</span>
          </span>
        </div>
        <div
          className="appr-panel-layout__list-body"
          role={isEmpty ? undefined : "tablist"}
          aria-orientation={isEmpty ? undefined : "vertical"}
          aria-label={isEmpty ? undefined : "승인 요청"}
          onKeyDown={handleListKeyDown}
          ref={listRef}
        >
          {isEmpty ? (
            <div className="appr-panel-layout__list-empty" role="status">
              <p className="appr-panel-layout__list-empty-title">{emptyTitle}</p>
              {emptyHint ? (
                <p className="appr-panel-layout__list-empty-hint">{emptyHint}</p>
              ) : null}
              {hasProject && sevenDayStats.resolved > 0 ? (
                <p className="appr-panel-layout__list-empty-audit">
                  지난 7일 {sevenDayStats.resolved}건 결정 · 평균{" "}
                  {formatHoursPrecise(sevenDayStats.avgDecisionMs)}
                </p>
              ) : null}
            </div>
          ) : (
            approvals.map((approval) => {
              const isSelected = (selected?.id ?? null) === approval.id;
              const expiresAtMs = new Date(approval.expiresAt).getTime();
              const isImminent =
                approval.status === "pending" &&
                expiresAtMs - Date.now() <= 24 * 60 * 60 * 1000 &&
                expiresAtMs >= Date.now();
              const tabId = `appr-li-tab-${approval.id}`;
              return (
                <button
                  key={approval.id}
                  type="button"
                  role="tab"
                  id={tabId}
                  aria-selected={isSelected}
                  aria-controls="appr-detail-pane"
                  tabIndex={isSelected ? 0 : -1}
                  className={`appr-li s-${approval.status} ${actionKind(approval.actionType)}${
                    isSelected ? " is-selected" : ""
                  }${isImminent ? " is-imminent" : ""}`}
                  onClick={() => onSelect(approval.id)}
                  data-approval-id={approval.id}
                >
                  <span className="appr-li__icon" aria-hidden="true">
                    <ActionIconNode approval={approval} />
                  </span>
                  <span className="appr-li__body">
                    <span className="appr-li__top">
                      <span className="appr-li__id">{approval.id}</span>
                      <span className="appr-li__time">
                        {formatDateTime(approval.createdAt)}
                      </span>
                    </span>
                    <span className="appr-li__title">
                      {ACTION_LABELS[approval.actionType] ?? approval.actionType}
                    </span>
                    <span className="appr-li__sub">
                      {ACTION_EYEBROW[approval.actionType] ?? approval.actionType.toUpperCase()}
                      {" · "}
                      {approval.requestedBy}
                    </span>
                  </span>
                  <VerdictMini status={approval.status} />
                </button>
              );
            })
          )}
        </div>
      </div>

      <div
        className={`appr-detail-pane${selected ? "" : " is-empty"}`}
        id="appr-detail-pane"
        role="tabpanel"
        aria-labelledby={selected ? `appr-li-tab-${selected.id}` : undefined}
      >
        {selected ? (
          <ApprovalDetailPane
            approval={selected}
            decidingId={decidingId}
            onOpenTarget={onOpenTarget}
            onDecide={onDecide}
          />
        ) : (
          <div className="appr-detail-pane__empty">
            <p className="appr-detail-pane__empty-text">선택된 요청이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface ApprovalDetailPaneProps {
  approval: ApprovalRequest;
  decidingId: string | null;
  onOpenTarget: (approval: ApprovalRequest) => void;
  onDecide: (id: string, action: ApprovalDecisionAction, comment: string) => void | Promise<void>;
}

const DECISION_VERB: Record<ApprovalRequest["status"], string> = {
  pending: "님이 결정",
  approved: "님이 승인",
  rejected: "님이 거부",
  expired: "님의 결정 기록",
};

function ApprovalDetailPane({
  approval,
  decidingId,
  onOpenTarget,
  onDecide,
}: ApprovalDetailPaneProps) {
  const [comment, setComment] = useState("");
  useEffect(() => {
    setComment("");
  }, [approval.id]);

  const isPending = approval.status === "pending";
  const expiresAtMs = new Date(approval.expiresAt).getTime();
  const isExpired = expiresAtMs < Date.now();
  const targetLabel =
    approval.actionType === "gate.override" ? "Gate 보기" : "Finding 보기";
  const impactText = formatImpactSummary(approval.impactSummary);
  const metaRows = buildTargetSnapshotRows(approval.targetSnapshot, approval.actionType);
  const visibleMetaRows = metaRows.filter((row) => row.value !== null);
  const isProcessing = decidingId === approval.id;
  const canDecide = isPending && !isExpired;

  return (
    <>
      <header className="appr-detail__head">
        <div
          className={`appr-detail__icon ${actionKind(approval.actionType)}`}
          aria-hidden="true"
        >
          <ActionIconNode approval={approval} />
        </div>
        <div className="appr-detail__head-copy">
          <h3 className="appr-detail__title">
            <span className="appr-detail__title-text">
              {ACTION_LABELS[approval.actionType] ?? approval.actionType}
            </span>
            <span className="appr-detail__id">#{approval.id}</span>
          </h3>
          <p className="appr-detail__byline">
            <span className="appr-detail__author">{approval.requestedBy}</span>
            <span aria-hidden="true" className="appr-detail__byline-sep"> · </span>
            <span>{formatDateTime(approval.createdAt)} 등록</span>
            {isPending && !isExpired ? (
              <>
                <span aria-hidden="true" className="appr-detail__byline-sep"> · </span>
                <span>{formatDateTime(approval.expiresAt)} 만료</span>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={`approval-status approval-status--lg approval-status--${approval.status}`}
        >
          <span className="approval-status__dot" />
          {STATUS_LABELS[approval.status]}
        </span>
      </header>

      <div className="appr-detail__body">
        <p className="appr-detail__reason">{approval.reason}</p>

        <dl className="appr-detail__inline-meta">
          <div className="appr-detail__inline-row">
            <dt>영향</dt>
            <dd>
              {impactText ?? <span className="appr-detail__placeholder">—</span>}
            </dd>
          </div>
          <div className="appr-detail__inline-row">
            <dt>타겟</dt>
            <dd>
              {visibleMetaRows.length === 0 ? (
                <span className="appr-detail__placeholder">—</span>
              ) : (
                visibleMetaRows.map((row, index) => (
                  <React.Fragment key={row.key}>
                    {index > 0 ? (
                      <span aria-hidden="true" className="appr-detail__inline-sep"> · </span>
                    ) : null}
                    <span className="appr-detail__inline-pair">
                      <b className="appr-detail__inline-label">{row.label}</b>
                      <span className="appr-detail__inline-value">{row.value}</span>
                    </span>
                  </React.Fragment>
                ))
              )}
              <button
                type="button"
                className="appr-detail__target-link"
                onClick={() => onOpenTarget(approval)}
              >
                <ExternalLink size={12} aria-hidden="true" />
                {targetLabel}
              </button>
            </dd>
          </div>
        </dl>

        {approval.decision ? (
          <blockquote className={`appr-detail__decision-quote s-${approval.status}`}>
            <p className="appr-detail__decision-attr">
              <b className="appr-detail__decision-by">{approval.decision.decidedBy}</b>
              {DECISION_VERB[approval.status]}
              <span aria-hidden="true" className="appr-detail__byline-sep"> · </span>
              <span>{formatDateTime(approval.decision.decidedAt)}</span>
            </p>
            {approval.decision.comment ? (
              <p className="appr-detail__decision-comment">
                "{approval.decision.comment}"
              </p>
            ) : null}
          </blockquote>
        ) : null}
      </div>

      {canDecide ? (
        <footer className="appr-detail__decide">
          <label className="appr-detail__decide-label" htmlFor="appr-decide-comment">
            결정 사유<span className="appr-detail__decide-optional"> (선택)</span>
          </label>
          <textarea
            id="appr-decide-comment"
            className="appr-detail__decide-textarea"
            placeholder="후속 조치 / 결정 근거를 남기면 감사 로그에 기록됩니다."
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
          />
          <div className="appr-detail__decide-actions">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => onDecide(approval.id, "rejected", comment)}
              disabled={isProcessing}
            >
              {isProcessing ? "처리 중..." : "거부"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onDecide(approval.id, "approved", comment)}
              disabled={isProcessing}
            >
              {isProcessing ? "처리 중..." : "승인"}
            </button>
          </div>
        </footer>
      ) : null}
    </>
  );
}
