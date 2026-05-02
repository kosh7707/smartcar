import "./AdminRegistrationsPage.css";
import React from "react";
import { PageHeader } from "@/common/ui/primitives";
import { useAdminRegistrationsPageController } from "./useAdminRegistrationsPageController";
import { AdminRegistrationsRefreshButton } from "./components/AdminRegistrationsRefreshButton/AdminRegistrationsRefreshButton";
import { AdminRegistrationsKpiBar } from "./components/AdminRegistrationsKpiBar/AdminRegistrationsKpiBar";
import { AdminRegistrationsErrorNotice } from "./components/AdminRegistrationsErrorNotice/AdminRegistrationsErrorNotice";
import { AdminRegistrationsListPanel } from "./components/AdminRegistrationsListPanel/AdminRegistrationsListPanel";

export const AdminRegistrationsPage: React.FC = () => {
  const {
    counts,
    loading,
    loadError,
    actionError,
    busy,
    refresh,
    approve,
    reject,
    clearActionError,
    filter,
    setFilter,
    displayRequests,
  } = useAdminRegistrationsPageController();

  return (
    <div className="page-shell admin-reg-page">
      <PageHeader
        surface="plain"
        title="가입 요청 관리"
        action={<AdminRegistrationsRefreshButton loading={loading} onClick={() => void refresh()} />}
      />

      <AdminRegistrationsKpiBar
        pending={counts.pending}
        approved={counts.approved}
        rejected={counts.rejected}
        pendingActive={filter === "pending"}
      />

      {loadError ? <AdminRegistrationsErrorNotice message={loadError} /> : null}
      {actionError ? <AdminRegistrationsErrorNotice message={actionError} onClose={clearActionError} /> : null}

      <AdminRegistrationsListPanel
        loading={loading}
        requests={displayRequests}
        busy={busy}
        filter={filter}
        onFilterChange={setFilter}
        onApprove={approve}
        onReject={reject}
      />
    </div>
  );
};
