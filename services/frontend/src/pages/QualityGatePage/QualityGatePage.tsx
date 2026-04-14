import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { Spinner, EmptyState, PageHeader } from "../../shared/ui";
import { QualityGateCard } from "./components/QualityGateCard";
import { QualityGateSidebar } from "./components/QualityGateSidebar";
import { QualityGateStatusBanner } from "./components/QualityGateStatusBanner";
import { useQualityGatePage } from "./hooks/useQualityGatePage";
import "./QualityGatePage.css";

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
    document.title = "AEGIS — Quality Gate";
  }, []);

  if (loading) {
    return <div className="page-enter centered-loader"><Spinner size={36} label="Quality Gate 로딩 중..." /></div>;
  }

  return (
    <div className="page-enter">
      <PageHeader
        surface="plain"
        title="Quality Gate"
        subtitle={latestGate ? "최근 평가 결과와 규칙 상태를 검토합니다." : "분석 결과가 준비되면 게이트가 자동으로 평가됩니다."}
      />

      {latestGate ? <QualityGateStatusBanner gate={latestGate} /> : null}

      {gates.length === 0 ? (
        <EmptyState
          title="아직 Quality Gate 결과가 없습니다"
          description="분석을 실행하면 자동으로 Quality Gate가 평가됩니다."
        />
      ) : (
        <div className="gate-content-grid">
          <div className="gate-criteria-col">
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
