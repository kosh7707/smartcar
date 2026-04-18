import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { EmptyState, PageHeader, Spinner } from "../../shared/ui";
import { QualityGateCard } from "./components/QualityGateCard";
import { QualityGateSidebar } from "./components/QualityGateSidebar";
import { QualityGateStatusBanner } from "./components/QualityGateStatusBanner";
import { useQualityGatePage } from "./hooks/useQualityGatePage";

export const QualityGatePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();
  const {
    gates,
    latestGate,
    loading,
    overrideTarget,
    setOverrideTarget,
    overrideReason,
    setOverrideReason,
    overriding,
    resetOverrideDraft,
    handleOverride,
  } = useQualityGatePage(projectId, toast);

  useEffect(() => {
    document.title = "AEGIS — 품질 게이트";
  }, []);

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="품질 게이트 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader
        surface="plain"
        title="품질 게이트"
        subtitle={
          latestGate
            ? "최근 평가 결과와 규칙 상태를 검토합니다."
            : "분석 결과가 준비되면 게이트가 자동으로 평가됩니다."
        }
      />

      {latestGate ? <QualityGateStatusBanner gate={latestGate} /> : null}

      {gates.length === 0 ? (
        <EmptyState
          className="empty-state--workspace"
          title="아직 품질 게이트 결과가 없습니다"
          description="정적 분석이 완료되면 실패 규칙, 경고 항목, 승인 필요 조건이 이 작업면에 운영 순서대로 정리됩니다."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)] xl:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            {gates.map((gate) => (
              <QualityGateCard
                key={gate.id}
                gate={gate}
                overrideTarget={overrideTarget}
                overrideReason={overrideReason}
                overriding={overriding}
                onSetOverrideTarget={setOverrideTarget}
                onSetOverrideReason={setOverrideReason}
                onSubmitOverride={handleOverride}
                onCancelOverride={resetOverrideDraft}
              />
            ))}
          </div>
          <QualityGateSidebar gates={gates} />
        </div>
      )}
    </div>
  );
};
