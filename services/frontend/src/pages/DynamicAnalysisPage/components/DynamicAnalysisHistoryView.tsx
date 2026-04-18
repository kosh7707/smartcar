import React from "react";
import type { DynamicAnalysisSession } from "@aegis/shared";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Radio,
  Trash2,
  Plug,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ConnectionStatusBanner,
  ConfirmDialog,
  ListItem,
  PageHeader,
  Spinner,
} from "../../../shared/ui";
import { STATUS_LABELS } from "../../../constants/dynamic";
import { formatDateTime } from "../../../utils/format";

const getSessionBadgeClass = (status: string) =>
  ({
    monitoring: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    stopped: "border-border bg-muted text-muted-foreground",
    connected: "border-border bg-muted text-foreground",
  }[status] ?? "border-border bg-background text-muted-foreground");

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

export const DynamicAnalysisHistoryView: React.FC<
  DynamicAnalysisHistoryViewProps
> = ({
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
  <div className="page-enter space-y-6">
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

    {adapterWarning && (
      <Alert variant="destructive">
        <AlertTriangle size={16} />
        <AlertTitle>연결된 어댑터가 없습니다.</AlertTitle>
        <AlertDescription>
          <a
            href={`#/projects/${projectId}/settings`}
            className="font-medium underline underline-offset-4"
          >
            프로젝트 설정
          </a>
          에서 어댑터를 연결해주세요.
        </AlertDescription>
      </Alert>
    )}

    {historyLoading ? (
      <div className="centered-loader--compact">
        <Spinner label="세션 이력 로딩 중..." />
      </div>
    ) : sessions.length === 0 ? (
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-6 py-8 text-center sm:py-10">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Monitoring workspace
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              아직 동적 분석 이력이 없습니다
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
              CAN 트래픽 모니터링을 시작하면 어댑터 연결 상태, 수신 메시지
              이상 징후, 세션 이력이 이 작업면에 순서대로 쌓입니다.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
              <CheckCircle2 size={14} /> 어댑터 연결 확인
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
              <CheckCircle2 size={14} /> CAN 트래픽 수집
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
              <CheckCircle2 size={14} /> 이상 징후 탐지
            </Badge>
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
      <Card className="shadow-none">
        <CardContent className="space-y-2">
          {sessions.map((session, index) => (
            <ListItem
              key={session.id}
              onClick={() => onOpenSession(session)}
              divider={index < sessions.length - 1}
              trailing={
                <>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(session.startedAt)}
                  </span>
                  {session.status === "monitoring" && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      title="종료"
                      onClick={(event) => {
                        event.stopPropagation();
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
                      className="opacity-0 transition-opacity group-hover/list-item:opacity-100"
                      title="삭제"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </>
              }
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge
                    variant="outline"
                    className={cn("min-h-7 rounded-full px-2.5 text-sm", getSessionBadgeClass(session.status))}
                  >
                    <Activity size={11} />
                    {STATUS_LABELS[session.status] ?? session.status}
                  </Badge>
                  <Badge variant="outline" className="min-h-7 rounded-full px-2.5 text-sm">
                    <Plug size={11} />
                    {session.source.adapterName ?? "어댑터"}
                  </Badge>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Radio size={12} /> {session.messageCount}건
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <AlertTriangle size={12} /> {session.alertCount}건
                  </span>
                </div>
                {session.endedAt && (
                  <div className="pl-1 text-sm text-muted-foreground">
                    종료: {formatDateTime(session.endedAt)}
                  </div>
                )}
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
