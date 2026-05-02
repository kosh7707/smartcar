import "./AdminRegistrationsRowApproveActions.css";
import React from "react";
import type { UserRole } from "@aegis/shared";
import { Check, X } from "lucide-react";

const ROLE_OPTIONS: UserRole[] = ["viewer", "analyst", "admin"];
const ROLE_LABELS: Record<UserRole, string> = {
  viewer: "viewer (열람자)",
  analyst: "analyst (분석가)",
  admin: "admin (관리자)",
};

interface AdminRegistrationsRowApproveActionsProps {
  fullName: string;
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  onApprove: () => void;
  onEnterRejectMode: () => void;
  busy?: "approve" | "reject";
}

export const AdminRegistrationsRowApproveActions: React.FC<AdminRegistrationsRowApproveActionsProps> = ({
  fullName,
  role,
  onRoleChange,
  onApprove,
  onEnterRejectMode,
  busy,
}) => {
  const isBusy = busy !== undefined;
  return (
    <div className="admin-reg-row__actions">
      <label className="admin-reg-role">
        <span className="admin-reg-role__label">Role</span>
        <select
          className="admin-reg-role__select"
          value={role}
          onChange={(event) => onRoleChange(event.target.value as UserRole)}
          disabled={isBusy}
          aria-label={`${fullName} 역할 선택`}
        >
          {ROLE_OPTIONS.map((value) => (
            <option key={value} value={value}>{ROLE_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn-primary btn-sm" onClick={onApprove} disabled={isBusy}>
        <Check size={14} aria-hidden="true" />
        {busy === "approve" ? "승인 중..." : "승인"}
      </button>
      <button type="button" className="btn btn-outline btn-sm" onClick={onEnterRejectMode} disabled={isBusy}>
        <X size={14} aria-hidden="true" />
        반려
      </button>
    </div>
  );
};
