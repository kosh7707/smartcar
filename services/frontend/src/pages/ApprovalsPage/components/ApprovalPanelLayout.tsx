import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { ShieldOff, AlertOctagon, ExternalLink, Clock, Inbox, CheckCheck } from "lucide-react";
import type { ApprovalRequest } from "../../../api/approval";
import { formatDateTime } from "../../../utils/format";
import type { ApprovalDecisionAction } from "../hooks/useApprovalsPage";
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
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenTarget: (approval: ApprovalRequest) => void;
  onStartDecision: (approvalId: string, action: ApprovalDecisionAction) => void;
  emptyHint: { resolved: number; avgDecisionMs: number | null };
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

function formatHoursPrecise(ms: number | null): string {
  if (ms === null) return "—";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 0.1) return "<0.1시간";
  return `${hours.toFixed(1)}시간`;
}

// Keyboard nav per US-007: ArrowUp/Down navigate, roving tabindex.
export const ApprovalPanelLayout: React.FC<ApprovalPanelLayoutProps> = ({
  approvals,
  selectedId,
  onSelect,
  onOpenTarget,
  onStartDecision,
  emptyHint,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Falls back to first approval so the detail pane renders before the auto-select effect fires.
  const selected = useMemo(
    () =>
      approvals.find((approval) => approval.id === selectedId) ??
      approvals[0] ??
      null,
    [approvals, selectedId],
  );

  // auto-select first when list non-empty and no current selection
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
          role="tablist"
          aria-orientation="vertical"
          aria-label="승인 요청"
          onKeyDown={handleListKeyDown}
          ref={listRef}
        >
          {approvals.length === 0 ? (
            <div className="empty-state is-inline appr-panel-layout__empty" role="presentation">
              <div className="empty-state__icon" aria-hidden="true">
                <Inbox />
              </div>
              <div className="empty-state__copy">
                <h3 className="empty-state__title">큐가 비어 있습니다</h3>
                <p className="empty-state__desc">대기 중인 요청이 없습니다.</p>
              </div>
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
            onOpenTarget={onOpenTarget}
            onStartDecision={onStartDecision}
          />
        ) : (
          <div className="empty-state appr-detail-pane__empty">
            <div className="empty-state__icon" aria-hidden="true">
              <CheckCheck />
            </div>
            <div className="empty-state__copy">
              <h3 className="empty-state__title">선택된 요청이 없습니다</h3>
              <p className="empty-state__desc">
                좌측 목록에서 요청을 선택하면 상세 정보가 여기에 표시됩니다.
              </p>
            </div>
            {emptyHint.resolved > 0 ? (
              <div className="empty-state__hint">
                <Clock aria-hidden="true" />
                지난 7일간 <b>{emptyHint.resolved}</b>건 처리 완료 · 평균{" "}
                <b>{formatHoursPrecise(emptyHint.avgDecisionMs)}</b>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

interface ApprovalDetailPaneProps {
  approval: ApprovalRequest;
  onOpenTarget: (approval: ApprovalRequest) => void;
  onStartDecision: (approvalId: string, action: ApprovalDecisionAction) => void;
}

function ApprovalDetailPane({
  approval,
  onOpenTarget,
  onStartDecision,
}: ApprovalDetailPaneProps) {
  const isPending = approval.status === "pending";
  const expiresAtMs = new Date(approval.expiresAt).getTime();
  const isExpired = expiresAtMs < Date.now();
  const targetLabel =
    approval.actionType === "gate.override" ? "Gate 보기" : "Finding 보기";
  const impactText = formatImpactSummary(approval.impactSummary);
  const metaRows = buildTargetSnapshotRows(approval.targetSnapshot, approval.actionType);

  return (
    <>
      <div className="appr-detail-pane__head">
        <div
          className={`appr-detail-pane__head-icon ${actionKind(approval.actionType)}`}
          aria-hidden="true"
        >
          <ActionIconNode approval={approval} />
        </div>
        <div className="appr-detail-pane__head-copy">
          <div className="appr-detail-pane__eyebrow">
            <span className="lab">
              {ACTION_EYEBROW[approval.actionType] ?? approval.actionType.toUpperCase()}
            </span>
            <span className="id">{approval.id}</span>
          </div>
          <h3 className="appr-detail-pane__title">
            {ACTION_LABELS[approval.actionType] ?? approval.actionType}
          </h3>
          <div className="appr-meta">
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
              <span className="mi">
                <b>EXP</b>
                {formatDateTime(approval.expiresAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="appr-detail-pane__head-aside">
          <span
            className={`approval-status approval-status--lg approval-status--${approval.status}`}
          >
            <span className="approval-status__dot" />
            {STATUS_LABELS[approval.status]}
          </span>
        </div>
      </div>
      <div className="appr-detail-pane__body">
        <section className="appr-detail-pane__section">
          <div className="appr-detail-pane__section-lab">요청 사유</div>
          <div className="appr-detail-pane__reason">{approval.reason}</div>
        </section>
        <section className="appr-detail-pane__section">
          <div className="appr-detail-pane__section-lab">결정의 영향</div>
          {impactText ? (
            <div className="appr-detail-pane__impact">
              <div className="appr-detail-pane__impact-body">
                <div className="appr-detail-pane__impact-title">
                  결정 영향 요약
                </div>
                <div className="appr-detail-pane__impact-text">{impactText}</div>
              </div>
            </div>
          ) : (
            <div className="appr-detail-pane__impact appr-detail-pane__impact--placeholder">
              <span className="appr-detail-pane__impact-placeholder">
                — 영향 요약 데이터 없음
              </span>
            </div>
          )}
        </section>
        <section className="appr-detail-pane__section">
          <div className="appr-detail-pane__section-lab">실행 정보</div>
          <div className="appr-detail-pane__meta-grid">
            {metaRows.map((row) => (
              <div className="appr-detail-pane__meta-row" key={row.key}>
                <span className="k">{row.label}</span>
                <span className="v">
                  {row.value ?? <span className="appr-detail-pane__meta-placeholder">—</span>}
                </span>
              </div>
            ))}
          </div>
        </section>
        {approval.decision ? (
          <section className="appr-detail-pane__section">
            <div className="appr-detail-pane__section-lab">결정 이력</div>
            <div className="appr-detail-pane__decision">
              <span className="appr-detail-pane__decision-by">
                {approval.decision.decidedBy} · {formatDateTime(approval.decision.decidedAt)}
              </span>
              {approval.decision.comment ? (
                <span className="appr-detail-pane__decision-comment">
                  "{approval.decision.comment}"
                </span>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
      <div className="appr-detail-pane__foot">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onOpenTarget(approval)}
        >
          <ExternalLink size={14} aria-hidden="true" />
          {targetLabel}
        </button>
        <div className="appr-detail-pane__foot-gap" aria-hidden="true" />
        {isPending && !isExpired ? (
          <>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => onStartDecision(approval.id, "rejected")}
            >
              거부
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onStartDecision(approval.id, "approved")}
            >
              승인
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
