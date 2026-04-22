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

export const DynamicAnalysisConfigView: React.FC<DynamicAnalysisConfigViewProps> = ({ projectId, connected, selectedAdapterId, setSelectedAdapterId, creating, onBack, onStart }) => (
  <div className="page-shell">
    <BackButton onClick={onBack} label="이력으로" />
    <PageHeader title="새 세션" />

    <div className="panel">
      <div className="panel-head">
        <h3 className="panel-title">모니터링 설정</h3>
        <p className="panel-description">연결된 어댑터를 선택하고 실시간 CAN 트래픽 모니터링을 시작하세요.</p>
      </div>
      <div className="panel-body dynamic-config-card">
        <section className="dynamic-config-section">
          <label className="form-label dynamic-config-title">어댑터</label>
          {connected.length === 0 ? (
            <div className="panel panel-alert">
              <Plug size={16} />
              <strong className="alert-title">연결된 어댑터가 없습니다.</strong>
              <span className="alert-description">
                <a href={`#/projects/${projectId}/settings`} className="dynamic-config-inline-link">프로젝트 설정</a>에서 연결해주세요.
              </span>
            </div>
          ) : (
            <AdapterSelector adapters={connected} selectedId={selectedAdapterId} onSelect={setSelectedAdapterId} disabled={creating} />
          )}
        </section>

        <section className="dynamic-config-section">
          <label className="form-label dynamic-config-title">모니터링 모드</label>
          <div className="dynamic-config-mode">
            <div className="dynamic-config-mode-icon"><Radio size={16} /></div>
            <div className="dynamic-config-mode-copy">
              <div className="dynamic-config-title">실시간 CAN 트래픽 모니터링</div>
              <p>어댑터를 통해 CAN 버스 트래픽을 실시간으로 수집하고, 이상 패턴을 탐지합니다. 세션 종료 시 수집된 메시지와 알림 이력이 저장됩니다.</p>
            </div>
          </div>
        </section>

        <div>
          <button type="button" className="btn btn-primary btn-sm" disabled={!selectedAdapterId || creating} onClick={onStart}>{creating ? <Spinner size={14} /> : <Plug size={16} />}모니터링 시작</button>
        </div>
      </div>
    </div>

    {creating ? <div className="dynamic-config-loading page-loading-shell"><Spinner label="세션 생성 중..." /></div> : null}
  </div>
);
