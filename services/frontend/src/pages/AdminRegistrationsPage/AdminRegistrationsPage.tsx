import React, { useState } from "react";
import type { RegistrationRequest, UserRole } from "@aegis/shared";
import { AlertCircle, Check, RefreshCw, X } from "lucide-react";
import { PageHeader } from "../../shared/ui";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { useAdminRegistrations } from "./hooks/useAdminRegistrations";

const ROLE_OPTIONS: UserRole[] = ["viewer", "analyst", "admin"];
const ROLE_LABELS: Record<UserRole, string> = {
  viewer: "viewer (열람자)",
  analyst: "analyst (분석가)",
  admin: "admin (관리자)",
};

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
  if (status === "pending_admin_review") return <Badge variant="outline">pending</Badge>;
  if (status === "approved") return <Badge>approved</Badge>;
  return <Badge variant="destructive">rejected</Badge>;
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
    <div className="surface-panel" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <strong>{request.fullName}</strong>
            <StatusBadge status={request.status} />
            {request.assignedRole ? <Badge variant="outline">{ROLE_LABELS[request.assignedRole]}</Badge> : null}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--foreground-subtle)", marginTop: 4 }}>
            {request.email}
          </div>
          <div style={{ fontSize: 12, color: "var(--foreground-subtle)", marginTop: 4 }}>
            <span>{request.organizationName || request.organizationCode || request.organizationId}</span>
            <span style={{ margin: "0 var(--space-2)" }}>·</span>
            <span>요청 {formatDateTime(request.createdAt)}</span>
            {request.approvedAt ? (<><span style={{ margin: "0 var(--space-2)" }}>·</span><span>승인 {formatDateTime(request.approvedAt)}</span></>) : null}
            {request.rejectedAt ? (<><span style={{ margin: "0 var(--space-2)" }}>·</span><span>반려 {formatDateTime(request.rejectedAt)}</span></>) : null}
          </div>
          {request.decisionReason ? (
            <div style={{ fontSize: 12, color: "var(--foreground-subtle)", marginTop: 4 }}>반려 사유: {request.decisionReason}</div>
          ) : null}
        </div>

        {isPending ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {!rejectMode ? (
              <>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span>역할</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as UserRole)}
                    disabled={isBusy}
                    style={{ padding: "6px 8px", background: "var(--surface-2)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 6 }}
                  >
                    {ROLE_OPTIONS.map((value) => (
                      <option key={value} value={value}>{ROLE_LABELS[value]}</option>
                    ))}
                  </select>
                </label>
                <Button size="sm" onClick={() => onApprove(request.id, role)} disabled={isBusy}>
                  {busy === "approve" ? "승인 중..." : (<><Check aria-hidden="true" />승인</>)}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRejectMode(true)} disabled={isBusy}>
                  <X aria-hidden="true" />반려
                </Button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 320 }}>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="반려 사유를 입력하세요 (신청자에게 보관용으로 남습니다)"
                  rows={3}
                  disabled={isBusy}
                  style={{ padding: 8, background: "var(--surface-2)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "inherit", fontSize: 13 }}
                />
                <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                  <Button variant="ghost" size="sm" onClick={() => { setRejectMode(false); setReason(""); }} disabled={isBusy}>취소</Button>
                  <Button
                    variant="destructive"
                    size="sm"
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
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
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

  return (
    <div className="page-shell">
      <PageHeader
        surface="plain"
        title="가입 요청 관리"
        action={(
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw aria-hidden="true" />
            {loading ? "불러오는 중..." : "새로고침"}
          </Button>
        )}
      />

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Badge variant="outline">대기 {counts.pending}</Badge>
        <Badge>승인 완료 {counts.approved}</Badge>
        <Badge variant="destructive">반려 {counts.rejected}</Badge>
      </div>

      {loadError ? (
        <div className="notice" role="alert" style={{ borderColor: "var(--danger)", background: "var(--danger-surface)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <AlertCircle aria-hidden="true" />
          <div>{loadError}</div>
        </div>
      ) : null}

      {actionError ? (
        <div className="notice" role="alert" style={{ borderColor: "var(--danger)", background: "var(--danger-surface)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <AlertCircle aria-hidden="true" />
          <div style={{ flex: 1 }}>{actionError}</div>
          <Button variant="ghost" size="xs" onClick={clearActionError}>닫기</Button>
        </div>
      ) : null}

      {loading ? (
        <div className="surface-panel" style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--foreground-subtle)" }}>
          목록을 불러오는 중입니다...
        </div>
      ) : requests.length === 0 ? (
        <div className="surface-panel" style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--foreground-subtle)" }}>
          처리할 가입 요청이 없습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {requests.map((request) => (
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
    </div>
  );
};
