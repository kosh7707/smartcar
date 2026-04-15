import React from "react";
import type { DynamicAnalysisSession } from "@aegis/shared";
import { Activity, AlertTriangle, CheckCircle2, Plus, Radio, Trash2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionStatusBanner, ConfirmDialog, ListItem, PageHeader, Spinner } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";
import { STATUS_LABELS } from "../../../constants/dynamic";

interface DynamicAnalysisHistoryViewProps {
  projectId?: string;
  connectionState?: string;
  hasConnected: boolean;
  creating: boolean;
  adapterWarning: boolean;
  setAdapterWarning: (value: boolean) => void;
  historyLoading: boolean;
  sessions: DynamicAnalysisSession[];
  confirmStopId: string | null;
  setConfirmStopId: (id: string | null) => void;
  onOpenConfig: () => void;
  onOpenSession: (session: DynamicAnalysisSession) => void;
  onConfirmStop: (sessionId: string) => void;
}

export const DynamicAnalysisHistoryView: React.FC<DynamicAnalysisHistoryViewProps> = ({
  projectId,
  connectionState,
  hasConnected,
  creating,
  adapterWarning,
  setAdapterWarning,
  historyLoading,
  sessions,
  confirmStopId,
  setConfirmStopId,
  onOpenConfig,
  onOpenSession,
  onConfirmStop,
}) => (
  <div className="page-enter">
    <ConnectionStatusBanner connectionState={connectionState as any} />
    <PageHeader
      title="동적 분석"
      action={
        <Button onClick={() => {
          if (!hasConnected) { setAdapterWarning(true); return; }
          setAdapterWarning(false);
          onOpenConfig();
        }} disabled={creating}>
          {creating ? <Spinner size={14} /> : <Plus size={16} />}
          새 세션
        </Button>
      }
    />

    {adapterWarning && (
      <div className="adapter-warning card animate-fade-in">
        <AlertTriangle size={16} />
        <span>연결된 어댑터가 없습니다. <a href={`#/projects/${projectId}/settings`}>프로젝트 설정</a>에서 어댑터를 연결해주세요.</span>
      </div>
    )}

    {historyLoading ? (
      <div className="centered-loader--compact">
        <Spinner label="세션 이력 로딩 중..." />
      </div>
    ) : sessions.length === 0 ? (
      <section className="analysis-history-empty">
        <div className="analysis-history-empty__copy">
          <p className="analysis-history-empty__eyebrow">Monitoring workspace</p>
          <h2 className="analysis-history-empty__title">아직 동적 분석 이력이 없습니다</h2>
          <p className="analysis-history-empty__description">
            CAN 트래픽 모니터링을 시작하면 어댑터 연결 상태, 수신 메시지 이상 징후, 세션 이력이 이 작업면에 순서대로 쌓입니다.
          </p>
        </div>
        <div className="analysis-history-empty__readiness">
          <span><CheckCircle2 size={14} /> 어댑터 연결 확인</span>
          <span><CheckCircle2 size={14} /> CAN 트래픽 수집</span>
          <span><CheckCircle2 size={14} /> 이상 징후 탐지</span>
        </div>
        <div className="analysis-history-empty__actions">
          <Button onClick={() => {
            if (!hasConnected) { setAdapterWarning(true); return; }
            setAdapterWarning(false);
            onOpenConfig();
          }}>
            첫 세션 시작
          </Button>
        </div>
      </section>
    ) : (
      <div className="card">
        {sessions.map((session) => (
          <ListItem
            key={session.id}
            onClick={() => onOpenSession(session)}
            trailing={
              <>
                <span className="analysis-item__time">{formatDateTime(session.startedAt)}</span>
                {session.status === "monitoring" && (
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    title="종료"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmStopId(session.id);
                    }}
                  >
                    <Activity size={14} />
                  </Button>
                )}
                {session.status === "stopped" && (
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    className="analysis-item__delete"
                    title="삭제"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </>
            }
          >
            <div>
              <div className="analysis-item__header">
                <span className={`analysis-item__badge analysis-item__badge--${session.status}`}>
                  <Activity size={11} />
                  {STATUS_LABELS[session.status] ?? session.status}
                </span>
                <span className="analysis-item__badge">
                  <Plug size={11} />
                  {session.source.adapterName ?? "어댑터"}
                </span>
                <span className="analysis-item__stat">
                  <Radio size={12} /> {session.messageCount}건
                </span>
                <span className="analysis-item__stat">
                  <AlertTriangle size={12} /> {session.alertCount}건
                </span>
              </div>
              {session.endedAt && (
                <div className="analysis-item__sub">
                  종료: {formatDateTime(session.endedAt)}
                </div>
              )}
            </div>
          </ListItem>
        ))}
      </div>
    )}

    <ConfirmDialog
      open={confirmStopId !== null}
      title="세션 종료"
      message="세션을 종료하시겠습니까?"
      confirmLabel="종료"
      danger
      onConfirm={() => { if (confirmStopId) onConfirmStop(confirmStopId); setConfirmStopId(null); }}
      onCancel={() => setConfirmStopId(null)}
    />
  </div>
);
