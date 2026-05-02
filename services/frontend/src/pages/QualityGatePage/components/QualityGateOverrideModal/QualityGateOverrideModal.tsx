import "./QualityGateOverrideModal.css";
import React, { useEffect, useId, useState } from "react";
import { AlertOctagon, ShieldOff, X } from "lucide-react";
import { Modal } from "@/common/ui/primitives/Modal";
import type { GateResult } from "@/common/api/gate";

interface Props {
  open: boolean;
  gate: GateResult | null;
  reason: string;
  onChangeReason: (value: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  /** Display name shown in the actor confirm checkbox label. */
  actorDisplayName?: string;
}

const MIN_REASON_LENGTH = 10;

// .modal-content__shoulder.is-fail is gate-context P3 exception (handoff §2.2).
export function QualityGateOverrideModal({
  open,
  gate,
  reason,
  onChangeReason,
  submitting,
  onClose,
  onSubmit,
  actorDisplayName,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const [ticketRef, setTicketRef] = useState("");
  const [actorConfirmed, setActorConfirmed] = useState(false);

  // Reset auxiliary fields each time the modal opens for a new gate.
  useEffect(() => {
    if (open) {
      setTicketRef("");
      setActorConfirmed(false);
    }
  }, [open, gate?.id]);

  if (!open || !gate) return null;

  const failedCount = gate.rules.filter((rule) => rule.result === "failed").length;
  const trimmedLength = reason.trim().length;
  const reasonOk = trimmedLength >= MIN_REASON_LENGTH;
  const canSubmit = reasonOk && actorConfirmed && !submitting;
  const counterClass = reasonOk ? "modal-content__counter is-ok" : "modal-content__counter is-under";

  const failedRulesCopy = failedCount > 0
    ? `승인 시 ${failedCount}건의 실패 규칙이 무시됩니다.`
    : "이 결정은 감사 로그에 영구 기록됩니다.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descId}
      className="quality-gate-override-modal"
      initialFocusSelector="textarea"
    >
      <div className="modal-content__shoulder is-fail" aria-hidden="true" />
      <header className="modal-content__head">
        <div className="modal-content__head-icon is-fail" aria-hidden="true">
          <ShieldOff />
        </div>
        <div className="modal-content__head-copy">
          <h3 id={titleId} className="modal-content__title">
            오버라이드 요청 — 품질 게이트
          </h3>
          <p id={descId} className="modal-content__desc">
            이 요청은 승인 큐에 등록되며, 프로젝트 리드의 결정을 기다립니다.
          </p>
        </div>
        <button
          type="button"
          className="modal-content__close"
          aria-label="모달 닫기"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="modal-content__body">
        <div className="modal-content__impact" role="alert">
          <AlertOctagon aria-hidden="true" />
          <div>
            {failedCount > 0 ? (
              <span>
                승인 시 <b>{failedCount}건의 실패 규칙</b>이 무시됩니다 — 이 결정은 감사 로그에 영구
                기록됩니다.
              </span>
            ) : (
              <span>{failedRulesCopy}</span>
            )}
          </div>
        </div>

        <div className="modal-content__field">
          <label className="form-label" htmlFor="qg-override-reason">
            사유 <span className="modal-content__field-required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="qg-override-reason"
            className="form-input form-textarea"
            placeholder="우회가 필요한 구체적인 이유, 영향 범위, 후속 조치 일정을 작성하세요."
            value={reason}
            onChange={(event) => onChangeReason(event.target.value)}
          />
          <div className="modal-content__hint">
            <span>최소 {MIN_REASON_LENGTH}자 이상 — 사후 감사 추적을 위해 명확히 작성하세요.</span>
            <span className={counterClass}>
              {trimmedLength}/{MIN_REASON_LENGTH}
            </span>
          </div>
        </div>

        <div className="modal-content__field">
          <label className="form-label" htmlFor="qg-override-ticket">
            관련 티켓 (선택)
          </label>
          <input
            id="qg-override-ticket"
            className="form-input"
            placeholder="SEC-3071, JIRA-1284 등"
            value={ticketRef}
            onChange={(event) => setTicketRef(event.target.value)}
            aria-describedby="qg-override-ticket-hint"
          />
          <div id="qg-override-ticket-hint" className="modal-content__hint">
            <span>입력값은 audit-only — 영구 저장은 backend `GateResult.override.ticketRefs[]` 계약 확장 후 활성화 (S2 contract L1).</span>
          </div>
        </div>

        <label className="modal-content__confirm-line">
          <input
            type="checkbox"
            checked={actorConfirmed}
            onChange={(event) => setActorConfirmed(event.target.checked)}
          />
          <span>
            {actorDisplayName ? <b>{actorDisplayName}</b> : <b>본인</b>}이 이 결정의 요청자임을 확인합니다.
          </span>
        </label>
      </div>

      <footer className="modal-content__foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>
          취소
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {submitting ? "처리 중..." : "오버라이드 요청 제출"}
        </button>
      </footer>
    </Modal>
  );
}
