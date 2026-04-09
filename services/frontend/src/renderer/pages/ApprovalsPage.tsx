import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClipboardCheck, Clock, CheckCircle, XCircle, AlertCircle, Timer, ExternalLink } from "lucide-react";
import type { ApprovalRequest } from "../api/approval";
import { fetchProjectApprovals, decideApproval } from "../api/approval";
import { logError } from "../api/core";
import { useToast } from "../contexts/ToastContext";
import { Spinner, EmptyState, ConfirmDialog } from "../components/ui";
import { formatDateTime } from "../utils/format";
import "./ApprovalsPage.css";

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  pending: { icon: <Clock size={14} />, label: "대기", className: "approval-status--pending" },
  approved: { icon: <CheckCircle size={14} />, label: "승인됨", className: "approval-status--approved" },
  rejected: { icon: <XCircle size={14} />, label: "거부", className: "approval-status--rejected" },
  expired: { icon: <Timer size={14} />, label: "만료", className: "approval-status--expired" },
};

const ACTION_LABELS: Record<string, string> = {
  "gate.override": "Quality Gate 오버라이드",
  "finding.accepted_risk": "Finding 위험 수용",
};

type FilterStatus = "all" | "pending" | "approved" | "rejected" | "expired";

export const ApprovalsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    document.title = "AEGIS — Approvals";
  }, []);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decidingAction, setDecidingAction] = useState<"approved" | "rejected" | null>(null);
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchProjectApprovals(projectId);
      setApprovals(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      logError("Load approvals", e);
      toast.error("승인 요청 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { load(); }, [load]);

  const handleDecide = useCallback(async () => {
    if (!decidingId || !decidingAction) return;
    setProcessing(true);
    try {
      await decideApproval(decidingId, decidingAction, undefined, comment.trim() || undefined);
      toast.success(decidingAction === "approved" ? "승인 완료" : "거부 완료");
      setDecidingId(null);
      setDecidingAction(null);
      setComment("");
      load();
    } catch (e) {
      logError("Decide approval", e);
      toast.error("처리에 실패했습니다.");
    } finally {
      setProcessing(false);
    }
  }, [decidingId, decidingAction, comment, toast, load]);

  const filtered = filter === "all" ? approvals : approvals.filter((a) => a.status === filter);
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  if (loading) {
    return <div className="page-enter centered-loader"><Spinner size={36} label="승인 요청 로딩 중..." /></div>;
  }

  return (
    <div className="page-enter">
      {/* v6: page header */}
      <div className="approval-page-header">
        <div>
          <h1 className="approval-page-header__title">Approvals</h1>
          {pendingCount > 0 && (
            <p className="approval-page-header__subtitle">{pendingCount}건의 승인 요청이 대기 중입니다</p>
          )}
        </div>
      </div>

      <div className="approval-filters">
        {(["all", "pending", "approved", "rejected", "expired"] as FilterStatus[]).map((f) => (
          <button
            key={f}
            className={`approval-filter__btn${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "전체" : STATUS_CONFIG[f]?.label ?? f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={28} />}
          title={filter === "all" ? "승인 요청이 없습니다" : `${STATUS_CONFIG[filter]?.label ?? filter} 상태의 요청이 없습니다`}
        />
      ) : (
        <div className="approval-list">
          {filtered.map((approval) => {
            const config = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.pending;
            const isExpired = new Date(approval.expiresAt) < new Date();
            const isImminent = new Date(approval.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;
            return (
              <div key={approval.id} className={`approval-card card approval-card--${approval.status}`}>
                <div className="approval-card__header">
                  <div>
                    <h3 className="approval-card__action">
                      {ACTION_LABELS[approval.actionType] ?? approval.actionType}
                    </h3>
                    <div className="approval-card__meta">
                      <span>요청자: {approval.requestedBy}</span>
                      <span>{formatDateTime(approval.createdAt)}</span>
                      {!isExpired && approval.status === "pending" && (
                        <span className={`approval-card__expires${isImminent ? " approval-card__expires--imminent" : ""}`}>
                          만료: {formatDateTime(approval.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`approval-card__status-badge approval-card__status-badge--${approval.status}`}>
                    {config.icon} {config.label}
                  </span>
                </div>

                <div className="approval-card__body">
                  <div className="approval-card__reason">
                    <AlertCircle size={12} />
                    <span>{approval.reason}</span>
                  </div>
                  <button
                    className="approval-card__target"
                    onClick={() => {
                      if (approval.actionType === "gate.override") {
                        navigate(`/projects/${projectId}/quality-gate`);
                      } else {
                        navigate(`/projects/${projectId}/vulnerabilities`);
                      }
                    }}
                  >
                    <ExternalLink size={11} />
                    {approval.actionType === "gate.override" ? "Gate 보기" : "Finding 보기"}
                  </button>
                </div>

                {approval.decision && (
                  <div className="approval-card__decision">
                    <span>결정: {approval.decision.decidedBy} ({formatDateTime(approval.decision.decidedAt)})</span>
                    {approval.decision.comment && <span className="approval-card__comment">"{approval.decision.comment}"</span>}
                  </div>
                )}

                {approval.status === "pending" && !isExpired && (
                  <div className="approval-card__actions">
                    <button
                      className="btn btn-sm approval-btn--approve"
                      onClick={() => { setDecidingId(approval.id); setDecidingAction("approved"); }}
                    >
                      승인
                    </button>
                    <button
                      className="btn btn-sm approval-btn--reject"
                      onClick={() => { setDecidingId(approval.id); setDecidingAction("rejected"); }}
                    >
                      거부
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decision dialog */}
      {decidingId && decidingAction && (
        <div className="confirm-overlay" role="presentation" onClick={() => { setDecidingId(null); setDecidingAction(null); setComment(""); }}>
          <div className="confirm-dialog card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-dialog__title">
              {decidingAction === "approved" ? "승인 확인" : "거부 확인"}
            </h3>
            <textarea
              className="input"
              rows={3}
              placeholder="코멘트 (선택)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: "100%", marginBottom: "var(--cds-spacing-04)" }}
            />
            <div className="confirm-dialog__actions">
              <button className="btn btn-secondary btn-sm" onClick={() => { setDecidingId(null); setDecidingAction(null); setComment(""); }}>
                취소
              </button>
              <button
                className={`btn btn-sm${decidingAction === "rejected" ? " confirm-dialog__btn--cds-support-error" : ""}`}
                onClick={handleDecide}
                disabled={processing}
              >
                {processing ? "처리 중..." : decidingAction === "approved" ? "승인" : "거부"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
