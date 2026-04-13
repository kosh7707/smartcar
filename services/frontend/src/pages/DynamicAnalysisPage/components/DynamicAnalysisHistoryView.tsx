import React from "react";
import type { DynamicAnalysisSession } from "@aegis/shared";
import { Activity, AlertTriangle, Plus, Radio, Trash2, Plug } from "lucide-react";
import { ConnectionStatusBanner, ConfirmDialog, EmptyState, ListItem, PageHeader, Spinner } from "../../../shared/ui";
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
      icon={<Activity size={20} />}
      action={
        <button className="btn" onClick={() => {
          if (!hasConnected) { setAdapterWarning(true); return; }
          setAdapterWarning(false);
          onOpenConfig();
        }} disabled={creating}>
          {creating ? <Spinner size={14} /> : <Plus size={16} />}
          새 세션
        </button>
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
      <EmptyState
        icon={<Activity size={28} />}
        title="아직 동적 분석 이력이 없습니다"
        description="CAN 트래픽을 실시간으로 모니터링하고 이상을 탐지합니다"
        action={
          <button className="btn" onClick={() => {
            if (!hasConnected) { setAdapterWarning(true); return; }
            setAdapterWarning(false);
            onOpenConfig();
          }}>
            첫 세션 시작
          </button>
        }
      />
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
                  <button
                    className="btn-icon btn-danger"
                    title="종료"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmStopId(session.id);
                    }}
                  >
                    <Activity size={14} />
                  </button>
                )}
                {session.status === "stopped" && (
                  <button
                    className="btn-icon btn-danger analysis-item__delete"
                    title="삭제"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Trash2 size={14} />
                  </button>
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
