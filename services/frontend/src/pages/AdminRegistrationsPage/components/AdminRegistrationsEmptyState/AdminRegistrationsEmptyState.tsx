import "./AdminRegistrationsEmptyState.css";
import React from "react";

interface AdminRegistrationsEmptyStateProps {
  pendingFilter: boolean;
}

export const AdminRegistrationsEmptyState: React.FC<AdminRegistrationsEmptyStateProps> = ({ pendingFilter }) => (
  <div className="admin-reg-empty">
    <p className="admin-reg-empty__title">
      {pendingFilter ? "처리할 가입 요청이 없습니다" : "해당 상태의 요청이 없습니다"}
    </p>
    <p className="admin-reg-empty__desc">
      {pendingFilter
        ? "새 요청이 도착하면 이 자리에 표시됩니다."
        : "다른 필터를 선택해 이력을 확인하세요."}
    </p>
  </div>
);
