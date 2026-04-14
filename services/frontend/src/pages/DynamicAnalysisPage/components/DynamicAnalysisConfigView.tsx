import React from "react";
import type { Adapter } from "@aegis/shared";
import { Plug, Radio } from "lucide-react";
import { AdapterSelector, BackButton, PageHeader, Spinner } from "../../../shared/ui";

interface DynamicAnalysisConfigViewProps {
  projectId?: string;
  connected: Adapter[];
  selectedAdapterId: string | null;
  setSelectedAdapterId: (id: string | null) => void;
  creating: boolean;
  onBack: () => void;
  onStart: () => void;
}

export const DynamicAnalysisConfigView: React.FC<DynamicAnalysisConfigViewProps> = ({
  projectId,
  connected,
  selectedAdapterId,
  setSelectedAdapterId,
  creating,
  onBack,
  onStart,
}) => (
  <div className="page-enter">
    <BackButton onClick={onBack} label="이력으로" />
    <PageHeader title="새 세션" />

    <div className="card dyn-config">
      <div className="dyn-config__section">
        <label className="dyn-config__label">어댑터</label>
        {connected.length === 0 ? (
          <p className="dyn-config__hint" style={{ color: "var(--cds-support-error)" }}>
            연결된 어댑터가 없습니다.{" "}
            <a href={`#/projects/${projectId}/settings`}>프로젝트 설정</a>에서 연결해주세요.
          </p>
        ) : (
          <AdapterSelector
            adapters={connected}
            selectedId={selectedAdapterId}
            onSelect={setSelectedAdapterId}
            disabled={creating}
          />
        )}
      </div>

      <div className="dyn-config__section">
        <label className="dyn-config__label">모니터링 모드</label>
        <div className="dyn-config__mode-card">
          <Radio size={16} />
          <div>
            <div className="dyn-config__mode-title">실시간 CAN 트래픽 모니터링</div>
            <p className="dyn-config__mode-desc">
              어댑터를 통해 CAN 버스 트래픽을 실시간으로 수집하고, 이상 패턴을 탐지합니다.
              세션 종료 시 수집된 메시지와 알림 이력이 저장됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="dyn-config__actions">
        <button
          className="btn"
          disabled={!selectedAdapterId || creating}
          onClick={onStart}
        >
          {creating ? <Spinner size={14} /> : <Plug size={16} />}
          모니터링 시작
        </button>
      </div>
    </div>

    {creating && (
      <div className="centered-loader--compact">
        <Spinner label="세션 생성 중..." />
      </div>
    )}
  </div>
);
