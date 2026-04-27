import React from "react";
import { Modal } from "../../../shared/ui";
import type { ApprovalRequest } from "../../../api/approval";
import type { ApprovalDecisionAction } from "../hooks/useApprovalsPage";
import { buildTargetSnapshotRows, formatImpactSummary } from "./approvalPresentation";

interface ApprovalDecisionDialogProps {
  action: ApprovalDecisionAction;
  comment: string;
  processing: boolean;
  approval?: ApprovalRequest | null;
  onClose: () => void;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
}

// No self-mapping (handoff §9): absent data renders "—" placeholder.
export const ApprovalDecisionDialog: React.FC<ApprovalDecisionDialogProps> = ({
  action,
  comment,
  processing,
  approval,
  onClose,
  onCommentChange,
  onConfirm,
}) => {
  const isReject = action === "rejected";
  const title = isReject ? "거부 확인" : "승인 확인";
  const description = isReject
    ? "거부 사유를 남기면 신청자에게 보관용으로 전달되고 감사 추적에 함께 기록됩니다."
    : "결정 사유를 남기면 이후 감사 추적과 승인 이력 검토에 도움이 됩니다.";
  const confirmLabel = processing ? "처리 중..." : isReject ? "거부 확정" : "승인 확정";

  const impactText = approval ? formatImpactSummary(approval.impactSummary) : null;
  const metaRows = approval
    ? buildTargetSnapshotRows(approval.targetSnapshot, approval.actionType)
    : [];

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="approval-decision-title"
      describedBy="approval-decision-desc"
      className="panel approval-decision-dialog"
    >
      <header className="panel-head approval-decision-dialog__head">
        <h3 id="approval-decision-title">{title}</h3>
      </header>
      <div className="panel-body approval-decision-dialog__body">
        <p id="approval-decision-desc" className="approval-decision-dialog__description">
          {description}
        </p>
        {approval ? (
          <>
            <section
              className="appr-detail__impact approval-decision-dialog__impact"
              aria-label="결정 영향"
            >
              <div className="appr-detail__impact-body">
                <div className="appr-detail__impact-title">결정 영향</div>
                {impactText ? (
                  <div className="appr-detail__impact-text">{impactText}</div>
                ) : (
                  <div className="appr-detail__impact-text appr-detail__impact-placeholder">
                    — 영향 요약 데이터 없음
                  </div>
                )}
              </div>
            </section>
            <section
              className="appr-detail-pane__meta approval-decision-dialog__meta"
              aria-label="실행 정보"
            >
              <dl className="appr-detail-pane__meta-grid">
                {metaRows.map((row) => (
                  <div className="appr-detail-pane__meta-row" key={row.key}>
                    <dt className="k">{row.label}</dt>
                    <dd className="v">
                      {row.value ?? (
                        <span className="appr-detail-pane__meta-placeholder">—</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        ) : null}
        <div className="form-field">
          <label className="form-label" htmlFor="approval-decision-comment">
            코멘트{isReject ? "" : " (선택)"}
          </label>
          <textarea
            id="approval-decision-comment"
            className="approval-decision-dialog__textarea"
            rows={4}
            placeholder="코멘트 (선택)"
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            spellCheck={false}
          />
        </div>
      </div>
      <footer className="approval-decision-dialog__foot">
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={processing}>
          취소
        </button>
        <button
          type="button"
          className={`btn btn-sm ${isReject ? "btn-danger" : "btn-primary"}`}
          onClick={onConfirm}
          disabled={processing}
        >
          {confirmLabel}
        </button>
      </footer>
    </Modal>
  );
};
