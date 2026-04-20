import React from "react";
import type { DynamicAnalysisSession } from "@aegis/shared";
import { Activity, AlertTriangle, CheckCircle2, Plus, Radio, Trash2, Plug } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ConnectionStatusBanner, ConfirmDialog, ListItem, PageHeader, Spinner } from "../../../shared/ui";
import { STATUS_LABELS } from "../../../constants/dynamic";
import { formatDateTime } from "../../../utils/format";

const getSessionBadgeClass = (status: string) =>
  ({
    monitoring: "dynamic-status-badge dynamic-status-badge--monitoring",
    stopped: "dynamic-status-badge dynamic-status-badge--stopped",
    connected: "dynamic-status-badge dynamic-status-badge--connected",
  }[status] ?? "dynamic-status-badge dynamic-status-badge--default");

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

export const DynamicAnalysisHistoryView: React.FC<DynamicAnalysisHistoryViewProps> = ({ projectId, connectionState, hasConnected, creating, adapterWarning, setAdapterWarning, historyLoading, sessions, confirmStopId, setConfirmStopId, onOpenConfig, onOpenSession, onConfirmStop }) => (
  <div className="dynamic-history-shell">
    <ConnectionStatusBanner connectionState={connectionState as any} />
    <PageHeader
      title="동적 분석"
      action={
        <Button
          onClick={() => {
            if (!hasConnected) {
              setAdapterWarning(true);
              return;
            }
            setAdapterWarning(false);
            onOpenConfig();
          }}
          disabled={creating}
        >
          {creating ? <Spinner size={14} /> : <Plus size={16} />}
          새 세션
        </Button>
      }
    />

    {adapterWarning ? (
      <Alert variant="destructive">
        <AlertTriangle size={16} />
        <AlertTitle>연결된 어댑터가 없습니다.</AlertTitle>
        <AlertDescription>
          <a href={`#/projects/${projectId}/settings`} className="dynamic-history-inline-link">프로젝트 설정</a>에서 어댑터를 연결해주세요.
        </AlertDescription>
      </Alert>
    ) : null}

    {historyLoading ? (
      <div className="page-loading-shell"><Spinner label="세션 이력 로딩 중..." /></div>
    ) : sessions.length === 0 ? (
      <Card className="dynamic-history-empty">
        <CardContent>
          <div className="dynamic-history-empty-copy">
            <p className="dynamic-history-empty-eyebrow">Monitoring workspace</p>
            <h2 className="dynamic-history-empty-title">아직 동적 분석 이력이 없습니다</h2>
            <p className="dynamic-history-empty-body">CAN 트래픽 모니터링을 시작하면 어댑터 연결 상태, 수신 메시지 이상 징후, 세션 이력이 이 작업면에 순서대로 쌓입니다.</p>
          </div>

          <div className="dynamic-history-empty-tags">
            <Badge variant="outline" className="dynamic-history-tag"><CheckCircle2 size={14} /> 어댑터 연결 확인</Badge>
            <Badge variant="outline" className="dynamic-history-tag"><CheckCircle2 size={14} /> CAN 트래픽 수집</Badge>
            <Badge variant="outline" className="dynamic-history-tag"><CheckCircle2 size={14} /> 이상 징후 탐지</Badge>
          </div>

          <div>
            <Button
              onClick={() => {
                if (!hasConnected) {
                  setAdapterWarning(true);
                  return;
                }
                setAdapterWarning(false);
                onOpenConfig();
              }}
            >
              첫 세션 시작
            </Button>
          </div>
        </CardContent>
      </Card>
    ) : (
      <Card className="dynamic-history-list-card">
        <CardContent>
          {sessions.map((session, index) => (
            <ListItem
              key={session.id}
              onClick={() => onOpenSession(session)}
              divider={index < sessions.length - 1}
              trailing={
                <>
                  <span className="dynamic-history-session-meta">{formatDateTime(session.startedAt)}</span>
                  {session.status === "monitoring" ? (
                    <Button variant="destructive" size="icon-sm" title="종료" onClick={(event) => { event.stopPropagation(); setConfirmStopId(session.id); }}>
                      <Activity size={14} />
                    </Button>
                  ) : null}
                  {session.status === "stopped" ? (
                    <Button variant="destructive" size="icon-sm" title="삭제" onClick={(event) => { event.stopPropagation(); }}>
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                </>
              }
            >
              <div className="page-section-stack">
                <div className="dynamic-history-session-meta">
                  <Badge variant="outline" className={cn("dynamic-history-session-badge", getSessionBadgeClass(session.status))}><Activity size={11} />{STATUS_LABELS[session.status] ?? session.status}</Badge>
                  <Badge variant="outline" className="dynamic-history-session-badge"><Plug size={11} />{session.source.adapterName ?? "어댑터"}</Badge>
                  <span className="inline-stack"><Radio size={12} /> {session.messageCount}건</span>
                  <span className="inline-stack"><AlertTriangle size={12} /> {session.alertCount}건</span>
                </div>
                {session.endedAt ? <div className="dynamic-history-session-ended">종료: {formatDateTime(session.endedAt)}</div> : null}
              </div>
            </ListItem>
          ))}
        </CardContent>
      </Card>
    )}

    <ConfirmDialog
      open={confirmStopId !== null}
      title="세션 종료"
      message="세션을 종료하시겠습니까?"
      confirmLabel="종료"
      danger
      onConfirm={() => {
        if (confirmStopId) onConfirmStop(confirmStopId);
        setConfirmStopId(null);
      }}
      onCancel={() => setConfirmStopId(null)}
    />
  </div>
);
