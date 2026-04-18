import React, { useEffect, useMemo, useState } from "react";
import type {
  CanMessage,
  DynamicAlert,
  DynamicAnalysisSession,
} from "@aegis/shared";
import { AlertTriangle, Clock, Plug, Radio } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fetchDynamicSessionDetail, logError } from "../../../api/client";
import { STATUS_LABELS } from "../../../constants/dynamic";
import { useToast } from "../../../contexts/ToastContext";
import {
  BackButton,
  EmptyState,
  SeverityBadge,
  Spinner,
} from "../../../shared/ui";
import { formatDateTime, formatTime } from "../../../utils/format";

const tableHeadClass = "sticky top-0 z-10 bg-background/95 backdrop-blur";

const getSessionStatusClass = (status: string) =>
  ({
    monitoring: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    stopped: "border-border bg-muted text-muted-foreground",
    connected: "border-border bg-muted text-foreground",
  }[status] ?? "border-border bg-background text-muted-foreground");

interface Props {
  sessionId: string;
  onBack: () => void;
}

export const SessionDetailView: React.FC<Props> = ({ sessionId, onBack }) => {
  const [session, setSession] = useState<DynamicAnalysisSession | null>(null);
  const [alerts, setAlerts] = useState<DynamicAlert[]>([]);
  const [messages, setMessages] = useState<CanMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchDynamicSessionDetail(sessionId)
      .then((detail) => {
        setSession(detail.session);
        setAlerts(detail.alerts);
        setMessages(detail.recentMessages);
      })
      .catch((error) => {
        logError("Load session detail", error);
        toast.error("세션 정보를 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));
  }, [sessionId, toast]);

  const summaryItems = useMemo(
    () =>
      session
        ? [
            {
              label: "상태",
              value: (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-7 rounded-full px-2.5 text-sm",
                    getSessionStatusClass(session.status),
                  )}
                >
                  {STATUS_LABELS[session.status] ?? session.status}
                </Badge>
              ),
            },
            {
              label: "시작",
              icon: <Clock size={14} />,
              value: formatDateTime(session.startedAt),
            },
            ...(session.endedAt
              ? [
                  {
                    label: "종료",
                    icon: <Clock size={14} />,
                    value: formatDateTime(session.endedAt),
                  },
                ]
              : []),
            {
              label: "소스",
              icon: <Plug size={14} />,
              value: session.source.adapterName ?? "어댑터",
            },
            {
              label: "메시지",
              icon: <Radio size={14} />,
              value: `${session.messageCount}건`,
            },
            {
              label: "알림",
              icon: <AlertTriangle size={14} />,
              value: `${session.alertCount}건`,
            },
          ]
        : [],
    [session],
  );

  if (loading) {
    return (
      <div className="page-enter flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
        <Spinner size={36} label="세션 정보 로딩 중..." />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-enter space-y-4">
        <BackButton onClick={onBack} label="세션 목록으로" />
        <p className="text-sm text-muted-foreground">세션을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <BackButton onClick={onBack} label="세션 목록으로" />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>세션 요약</CardTitle>
          <CardDescription>
            동적 분석 세션의 상태, 시간 정보, 수집된 메시지 규모를 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summaryItems.map((item) => (
              <Card
                key={item.label}
                size="sm"
                className="border border-border/70 bg-muted/20 shadow-none"
              >
                <CardContent className="flex items-center gap-3 pt-3">
                  {item.icon && (
                    <div className="rounded-full border border-border/70 bg-background p-2 text-muted-foreground">
                      {item.icon}
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </div>
                    <div className="truncate text-sm font-medium text-foreground">
                      {item.value}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>탐지 알림 ({alerts.length})</CardTitle>
          <CardDescription>
            세션 중 기록된 이상 징후와 LLM 해석 결과를 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <EmptyState compact title="탐지된 이상이 없습니다" />
          ) : (
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Alert key={alert.id} className="items-start gap-3">
                    <AlertTriangle size={16} className="mt-0.5" />
                    <div className="space-y-3">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <SeverityBadge severity={alert.severity} size="sm" />
                          <AlertTitle>{alert.title}</AlertTitle>
                        </div>
                        <AlertDescription className="leading-6">
                          {alert.description}
                        </AlertDescription>
                      </div>
                      {alert.llmAnalysis && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-wide">
                            LLM
                          </Badge>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {alert.llmAnalysis}
                          </p>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatTime(alert.detectedAt)}
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>CAN 메시지 (최근 {messages.length}건)</CardTitle>
          <CardDescription>
            세션 종료 시점 기준으로 저장된 최근 CAN 패킷을 표시합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <EmptyState compact title="수신된 메시지가 없습니다" />
          ) : (
            <ScrollArea className="h-[320px] rounded-lg border">
              <Table className="text-sm">
                <TableHeader className={tableHeadClass}>
                  <TableRow>
                    <TableHead className={tableHeadClass}>시간</TableHead>
                    <TableHead className={tableHeadClass}>CAN ID</TableHead>
                    <TableHead className={cn(tableHeadClass, "text-center")}>DLC</TableHead>
                    <TableHead className={tableHeadClass}>데이터</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message, index) => (
                    <TableRow
                      key={index}
                      className={cn(
                        message.flagged &&
                          "border-l-4 border-l-destructive bg-destructive/5 text-destructive hover:bg-destructive/10",
                      )}
                    >
                      <TableCell className="text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </TableCell>
                      <TableCell className="font-mono font-medium text-primary">
                        {message.id}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {message.dlc}
                      </TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">
                        {message.data}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
