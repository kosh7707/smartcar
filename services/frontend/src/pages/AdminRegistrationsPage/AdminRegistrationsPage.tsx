import React, { useMemo, useState } from "react";
import type { RegistrationRequest, UserRole } from "@aegis/shared";
import { AlertCircle, Check, RefreshCw, X } from "lucide-react";
import { PageHeader } from "../../shared/ui";
import { useAdminRegistrations } from "./hooks/useAdminRegistrations";
import "./AdminRegistrationsPage.css";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const ROLE_OPTIONS: UserRole[] = ["viewer", "analyst", "admin"];
const ROLE_LABELS: Record<UserRole, string> = {
  viewer: "viewer (열람자)",
  analyst: "analyst (분석가)",
  admin: "admin (관리자)",
};

const FILTERS: { id: StatusFilter; label: string; dot?: "critical" | "running" | "stale" }[] = [
  { id: "pending",  label: "PENDING",  dot: "running" },
  { id: "approved", label: "APPROVED" },
  { id: "rejected", label: "REJECTED", dot: "critical" },
  { id: "all",      label: "ALL" },
];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: RegistrationRequest["status"] }) {
  if (status === "pending_admin_review") {
    return <span className="sev-chip medium"><span className="sev-dot" />pending</span>;
  }
  if (status === "approved") {
    return <span className="sev-chip low"><span className="sev-dot" />approved</span>;
  }
  return <span className="sev-chip critical"><span className="sev-dot" />rejected</span>;
}

type RowProps = {
  request: RegistrationRequest;
  busy: "approve" | "reject" | undefined;
  onApprove: (id: string, role: UserRole) => void;
  onReject: (id: string, reason: string) => Promise<boolean>;
};

const RegistrationRow: React.FC<RowProps> = ({ request, busy, onApprove, onReject }) => {
  const [role, setRole] = useState<UserRole>("analyst");
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");

  const isPending = request.status === "pending_admin_review";
  const isBusy = busy !== undefined;

  return (
    <div className={`admin-reg-row${isPending ? " admin-reg-row--pending" : ""}`}>
      <div className="admin-reg-row__body">
        <div className="admin-reg-row__head">
          <span className="admin-reg-row__name">{request.fullName}</span>
          <StatusBadge status={request.status} />
          {request.assignedRole ? (
            <span className="admin-reg-row__role-badge">{request.assignedRole}</span>
          ) : null}
        </div>
        <div className="admin-reg-row__email">{request.email}</div>
        <div className="admin-reg-row__meta">
          <span>{request.organizationName || request.organizationCode || request.organizationId}</span>
          <span>요청 {formatDateTime(request.createdAt)}</span>
          {request.approvedAt ? <span>승인 {formatDateTime(request.approvedAt)}</span> : null}
          {request.rejectedAt ? <span>반려 {formatDateTime(request.rejectedAt)}</span> : null}
        </div>
        {request.decisionReason ? (
          <div className="admin-reg-row__reason">반려 사유 — {request.decisionReason}</div>
        ) : null}
      </div>

      {isPending ? (
        !rejectMode ? (
          <div className="admin-reg-row__actions">
            <label className="admin-reg-role">
              <span className="admin-reg-role__label">Role</span>
              <select
                className="admin-reg-role__select"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                disabled={isBusy}
                aria-label={`${request.fullName} 역할 선택`}
              >
                {ROLE_OPTIONS.map((value) => (
                  <option key={value} value={value}>{ROLE_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onApprove(request.id, role)}
              disabled={isBusy}
            >
              <Check size={14} aria-hidden="true" />
              {busy === "approve" ? "승인 중..." : "승인"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setRejectMode(true)}
              disabled={isBusy}
            >
              <X size={14} aria-hidden="true" />
              반려
            </button>
          </div>
        ) : (
          <div className="admin-reg-reject">
            <textarea
              className="admin-reg-reject__textarea"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="반려 사유를 입력하세요 (신청자에게 보관용으로 남습니다)"
              rows={3}
              disabled={isBusy}
              spellCheck={false}
            />
            <div className="admin-reg-reject__actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setRejectMode(false); setReason(""); }}
                disabled={isBusy}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  const ok = await onReject(request.id, reason);
                  if (ok) {
                    setRejectMode(false);
                    setReason("");
                  }
                }}
                disabled={isBusy || !reason.trim()}
              >
                {busy === "reject" ? "반려 중..." : "반려 확정"}
              </button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
};

export const AdminRegistrationsPage: React.FC = () => {
  const {
    requests,
    counts,
    loading,
    loadError,
    actionError,
    busy,
    refresh,
    approve,
    reject,
    clearActionError,
  } = useAdminRegistrations();

  const [filter, setFilter] = useState<StatusFilter>("pending");

  const displayRequests = useMemo(() => {
    switch (filter) {
      case "pending":  return requests.filter((r) => r.status === "pending_admin_review");
      case "approved": return requests.filter((r) => r.status === "approved");
      case "rejected": return requests.filter((r) => r.status === "rejected");
      case "all":
      default:         return requests;
    }
  }, [requests, filter]);

  return (
    <div className="page-shell admin-reg-page">
      <PageHeader
        surface="plain"
        title="가입 요청 관리"
        action={(
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" />
            {loading ? "불러오는 중..." : "새로고침"}
          </button>
        )}
      />

      <div className="status-chips admin-reg-kpi" role="group" aria-label="가입 요청 현황">
        <div
          className={`status-chip admin-reg-kpi__chip admin-reg-kpi__chip--pending status-chip--pending${filter === "pending" ? " status-chip--active" : ""}`}
        >
          <span className="status-chip__label">대기</span>
          <span className="status-chip__count">{counts.pending}</span>
        </div>
        <div className="status-chip admin-reg-kpi__chip status-chip--approved">
          <span className="status-chip__label">승인 완료</span>
          <span className="status-chip__count">{counts.approved}</span>
        </div>
        <div className="status-chip admin-reg-kpi__chip status-chip--rejected">
          <span className="status-chip__label">반려</span>
          <span className="status-chip__count">{counts.rejected}</span>
        </div>
      </div>

      {loadError ? (
        <div className="admin-reg-notice" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <div className="admin-reg-notice__body">{loadError}</div>
        </div>
      ) : null}

      {actionError ? (
        <div className="admin-reg-notice" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <div className="admin-reg-notice__body">{actionError}</div>
          <button type="button" className="btn btn-ghost btn-sm admin-reg-notice__close" onClick={clearActionError}>
            닫기
          </button>
        </div>
      ) : null}

      <section className="panel" aria-label="가입 요청 목록">
        <div className="panel-head">
          <h3>요청 목록 <span className="count">{displayRequests.length}</span></h3>
          <div className="panel-tools">
            <div className="filter-pills filter-pills--tabs" role="tablist" aria-label="상태 필터">
              {FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === entry.id}
                  className={`pill${filter === entry.id ? " active" : ""}`}
                  onClick={() => setFilter(entry.id)}
                >
                  {entry.dot ? <span className={`dot ${entry.dot}`} aria-hidden="true" /> : null}
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-reg-empty">
            <p className="admin-reg-empty__desc">목록을 불러오는 중입니다...</p>
          </div>
        ) : displayRequests.length === 0 ? (
          <div className="admin-reg-empty">
            <p className="admin-reg-empty__title">
              {filter === "pending" ? "처리할 가입 요청이 없습니다" : "해당 상태의 요청이 없습니다"}
            </p>
            <p className="admin-reg-empty__desc">
              {filter === "pending"
                ? "새 요청이 도착하면 이 자리에 표시됩니다."
                : "다른 필터를 선택해 이력을 확인하세요."}
            </p>
          </div>
        ) : (
          <div className="admin-reg-list">
            {displayRequests.map((request) => (
              <RegistrationRow
                key={request.id}
                request={request}
                busy={busy[request.id]}
                onApprove={approve}
                onReject={reject}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
