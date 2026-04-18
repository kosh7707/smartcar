import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AttackScenario,
  CanInjectionResponse,
  CanMessage,
  DynamicAlert,
  DynamicAnalysisSession,
  InjectionClassification,
  WsMessage as SharedWsMessage,
} from "@aegis/shared";
import {
  AlertTriangle,
  Pause,
  Play,
  Plug,
  Radio,
  Send,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  fetchInjections,
  fetchScenarios,
  getWsBaseUrl,
  injectCanMessage,
  injectScenario,
  logError,
  stopDynamicSession,
} from "../../../api/client";
import { useToast } from "../../../contexts/ToastContext";
import {
  BackButton,
  ConnectionStatusBanner,
  SeverityBadge,
  Spinner,
} from "../../../shared/ui";
import { formatTime } from "../../../utils/format";
import {
  createReconnectingWs,
  parseWsMessage,
  type ConnectionState,
} from "../../../utils/wsEnvelope";

const MAX_MESSAGES = 500;

const injectionBadgeClass: Record<InjectionClassification, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  crash: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  anomaly: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  timeout: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
};

const tableHeadClass = "sticky top-0 z-10 bg-background/95 backdrop-blur";
const cellMonoClass = "font-mono text-xs sm:text-sm";

type PanelTab = "alerts" | "inject" | "history";

interface Props {
  session: DynamicAnalysisSession;
  onBack: () => void;
  onStopped: () => void;
}

export const MonitoringView: React.FC<Props> = ({
  session,
  onBack,
  onStopped,
}) => {
  const [messages, setMessages] = useState<CanMessage[]>([]);
  const [alerts, setAlerts] = useState<DynamicAlert[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnectionState, setWsConnectionState] =
    useState<ConnectionState>("disconnected");
  const [stopping, setStopping] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const bufferRef = useRef<CanMessage[]>([]);

  const [activeTab, setActiveTab] = useState<PanelTab>("alerts");
  const [scenarios, setScenarios] = useState<AttackScenario[]>([]);
  const [injections, setInjections] = useState<CanInjectionResponse[]>([]);
  const [injForm, setInjForm] = useState({
    canId: "",
    dlc: 8,
    data: "",
    label: "",
  });
  const [injecting, setInjecting] = useState(false);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [injError, setInjError] = useState<string | null>(null);

  const toast = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const canWrapperRef = useRef<HTMLDivElement>(null);

  const hasData = messages.length > 0 || messageCount > 0;

  useEffect(() => {
    const wsUrl = `${getWsBaseUrl()}/ws/dynamic-analysis?sessionId=${session.id}`;

    function wireHandlers(ws: WebSocket | null) {
      if (!ws) return;
      ws.onmessage = (event) => {
        try {
          const msg = parseWsMessage(event.data) as unknown as SharedWsMessage;
          switch (msg.type) {
            case "message":
              if (pausedRef.current) {
                const bufferedMessages = bufferRef.current;
                bufferedMessages.push(msg.payload);
                if (bufferedMessages.length > MAX_MESSAGES) {
                  bufferRef.current = bufferedMessages.slice(-MAX_MESSAGES);
                }
              } else {
                setMessages((previous) => {
                  const next = [...previous, msg.payload];
                  return next.length > MAX_MESSAGES
                    ? next.slice(-MAX_MESSAGES)
                    : next;
                });
              }
              break;
            case "alert":
              setAlerts((previous) => [msg.payload, ...previous]);
              break;
            case "status":
              setMessageCount(msg.payload.messageCount);
              setAlertCount(msg.payload.alertCount);
              break;
            case "injection-result":
              setInjections((previous) => [msg.payload, ...previous]);
              break;
            case "injection-error":
              setInjError(msg.payload.error);
              break;
          }
        } catch (error) {
          console.warn("[WS:dynamic-analysis] malformed message:", error);
        }
      };
    }

    const reconnectingWs = createReconnectingWs(() => wsUrl, {
      maxRetries: 10,
      onStateChange(state: ConnectionState) {
        setWsConnected(state === "connected");
        setWsConnectionState(state);
      },
      onReconnect() {
        wireHandlers(reconnectingWs.getWs());
      },
    });

    wireHandlers(reconnectingWs.getWs());
    wsRef.current = reconnectingWs.getWs();

    return () => {
      reconnectingWs.close();
      wsRef.current = null;
    };
  }, [session.id]);

  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch((error) => logError("Load scenarios", error));
    fetchInjections(session.id)
      .then((data) => setInjections([...data].reverse()))
      .catch((error) => logError("Load injections", error));
  }, [session.id]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused && bufferRef.current.length > 0) {
      const buffered = bufferRef.current;
      bufferRef.current = [];
      setMessages((previous) => {
        const next = [...previous, ...buffered];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    }
  }, [paused]);

  useEffect(() => {
    if (!paused && canWrapperRef.current) {
      canWrapperRef.current.scrollTop = canWrapperRef.current.scrollHeight;
    }
  }, [messages, paused]);

  const flaggedMessages = useMemo(
    () => messages.filter((message) => message.flagged),
    [messages],
  );

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      wsRef.current?.close();
      await stopDynamicSession(session.id);
      onStopped();
    } catch (error) {
      logError("Stop session", error);
      toast.error("세션 종료에 실패했습니다.");
      setStopping(false);
    }
  }, [onStopped, session.id, toast]);

  const handleInject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!injForm.canId || !injForm.data) return;

    setInjecting(true);
    setInjError(null);
    try {
      const result = await injectCanMessage(session.id, {
        canId: injForm.canId.trim(),
        dlc: injForm.dlc,
        data: injForm.data.trim(),
        label: injForm.label.trim() || undefined,
      });
      setInjections((previous) => [result, ...previous]);
    } catch (error) {
      setInjError(error instanceof Error ? error.message : "주입 실패");
    } finally {
      setInjecting(false);
    }
  };

  const handleRunScenario = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    setInjError(null);
    try {
      const results = await injectScenario(session.id, scenarioId);
      setInjections((previous) => [...[...results].reverse(), ...previous]);
    } catch (error) {
      setInjError(
        error instanceof Error ? error.message : "시나리오 실행 실패",
      );
    } finally {
      setRunningScenario(null);
    }
  };

  return (
    <div className="page-enter space-y-6">
      <ConnectionStatusBanner connectionState={wsConnectionState} />
      <BackButton onClick={onBack} label="세션 목록으로" />

      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge
              variant="outline"
              className={cn(
                "h-7 gap-1.5 rounded-full px-2.5 text-sm",
                wsConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {wsConnected ? "연결됨" : "연결 끊김"}
            </Badge>
            <Badge variant="outline" className="h-7 gap-1.5 rounded-full px-2.5 text-sm">
              <Plug size={12} />
              {session.source.adapterName ?? "어댑터"}
            </Badge>
            <Badge variant="outline" className="h-7 gap-1.5 rounded-full px-2.5 text-sm">
              <Radio size={12} /> 메시지 {messageCount || messages.length}
            </Badge>
            <Badge variant="outline" className="h-7 gap-1.5 rounded-full px-2.5 text-sm">
              <AlertTriangle size={12} /> 알림 {alertCount || alerts.length}
            </Badge>
          </div>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={handleStop}
            disabled={stopping}
          >
            {stopping ? <Spinner size={14} /> : <Square size={14} />}
            세션 종료
          </Button>
        </CardContent>
      </Card>

      {!hasData && (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full border border-dashed border-border bg-muted/40 p-4 text-muted-foreground">
              <Plug size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight">
                어댑터에서 데이터 대기 중...
              </h3>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                ECU 시뮬레이터 또는 실 ECU가 어댑터에 연결되면 CAN 데이터 수신이
                시작됩니다.
                <br />
                또는 아래 <strong>CAN 주입</strong> 탭에서 직접 메시지를 전송할 수
                있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>CAN 메시지</CardTitle>
                <CardDescription>
                  최근 {Math.min(messages.length, MAX_MESSAGES)}개의 메시지를 실시간으로
                  표시합니다.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  paused &&
                    "border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
                )}
                onClick={() => setPaused((previous) => !previous)}
              >
                {paused ? <Play size={12} /> : <Pause size={12} />}
                {paused ? "재개" : "일시정지"}
              </Button>
            </CardHeader>
            <CardContent>
              <div
                ref={canWrapperRef}
                className="h-[480px] overflow-y-auto rounded-lg border"
              >
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
                    {messages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-28 text-center text-sm text-muted-foreground">
                          CAN 메시지 대기 중...
                        </TableCell>
                      </TableRow>
                    ) : (
                      messages.map((message, index) => (
                        <TableRow
                          key={index}
                          className={cn(
                            message.flagged &&
                              "border-l-4 border-l-destructive bg-destructive/5 text-destructive hover:bg-destructive/10",
                            message.injected &&
                              !message.flagged &&
                              "border-l-4 border-l-primary bg-primary/5 hover:bg-primary/10",
                          )}
                        >
                          <TableCell className="text-muted-foreground">
                            {formatTime(message.timestamp)}
                          </TableCell>
                          <TableCell className={cn(cellMonoClass, "font-medium text-primary")}> 
                            <div className="flex items-center gap-2">
                              {message.injected && (
                                <Badge className="h-5 rounded-full px-1.5 text-[10px]">INJ</Badge>
                              )}
                              <span>{message.id}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {message.dlc}
                          </TableCell>
                          <TableCell className={cellMonoClass}>{message.data}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {flaggedMessages.length > 0 && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle size={14} />
                  알림 패킷 ({flaggedMessages.length})
                </CardTitle>
                <CardDescription>
                  탐지 규칙에 의해 표시된 패킷만 별도로 모아 보여줍니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px] rounded-lg border">
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
                      {flaggedMessages.map((message, index) => (
                        <TableRow
                          key={index}
                          className="border-l-4 border-l-destructive bg-destructive/5 text-destructive hover:bg-destructive/10"
                        >
                          <TableCell className="text-muted-foreground">
                            {formatTime(message.timestamp)}
                          </TableCell>
                          <TableCell className={cn(cellMonoClass, "font-medium text-destructive")}>
                            {message.id}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {message.dlc}
                          </TableCell>
                          <TableCell className={cellMonoClass}>{message.data}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="shadow-none">
          <CardContent className="pt-4">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as PanelTab)}
              className="gap-4"
            >
              <TabsList variant="line" className="w-full justify-start border-b rounded-none p-0">
                <TabsTrigger value="alerts" className="flex-1 gap-2 rounded-none pb-3">
                  알림
                  {alerts.length > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                      {alerts.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="inject" className="flex-1 gap-2 rounded-none pb-3">
                  CAN 주입
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 gap-2 rounded-none pb-3">
                  주입 이력
                  {injections.length > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                      {injections.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="alerts" className="mt-0">
                {alerts.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                    아직 탐지된 이상이 없습니다
                  </div>
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
              </TabsContent>

              <TabsContent value="inject" className="mt-0 space-y-4">
                <form onSubmit={handleInject} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px]">
                    <Label className="space-y-2 text-sm font-medium">
                      <span>CAN ID</span>
                      <Input
                        value={injForm.canId}
                        onChange={(event) =>
                          setInjForm((previous) => ({
                            ...previous,
                            canId: event.target.value,
                          }))
                        }
                        placeholder="0x7DF"
                      />
                    </Label>
                    <Label className="space-y-2 text-sm font-medium">
                      <span>DLC</span>
                      <Input
                        type="number"
                        min={0}
                        max={8}
                        value={injForm.dlc}
                        onChange={(event) =>
                          setInjForm((previous) => ({
                            ...previous,
                            dlc: Number(event.target.value),
                          }))
                        }
                      />
                    </Label>
                  </div>
                  <Label className="space-y-2 text-sm font-medium">
                    <span>Data</span>
                    <Input
                      className="font-mono"
                      value={injForm.data}
                      onChange={(event) =>
                        setInjForm((previous) => ({
                          ...previous,
                          data: event.target.value,
                        }))
                      }
                      placeholder="FF FF FF FF FF FF FF FF"
                    />
                  </Label>
                  <Label className="space-y-2 text-sm font-medium">
                    <span>Label (선택)</span>
                    <Input
                      value={injForm.label}
                      onChange={(event) =>
                        setInjForm((previous) => ({
                          ...previous,
                          label: event.target.value,
                        }))
                      }
                      placeholder="Diagnostic Request"
                    />
                  </Label>
                  <Button
                    type="submit"
                    disabled={
                      injecting ||
                      !injForm.canId.trim() ||
                      !injForm.data.trim() ||
                      stopping
                    }
                  >
                    {injecting ? <Spinner size={14} /> : <Send size={14} />}
                    주입
                  </Button>
                </form>

                {injError && (
                  <Alert variant="destructive">
                    <AlertTriangle size={16} />
                    <AlertTitle>주입 요청 실패</AlertTitle>
                    <AlertDescription>{injError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold">공격 시나리오</div>
                    <p className="text-sm text-muted-foreground">
                      준비된 시나리오를 실행해 ECU 응답을 비교합니다.
                    </p>
                  </div>
                  <ScrollArea className="h-[280px] pr-3">
                    <div className="space-y-3">
                      {scenarios.length === 0 ? (
                        <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
                          로딩 중...
                        </div>
                      ) : (
                        scenarios.map((scenario) => (
                          <Card
                            key={scenario.id}
                            size="sm"
                            className="border border-border/70 bg-muted/20 shadow-none"
                          >
                            <CardContent className="space-y-3 pt-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <SeverityBadge severity={scenario.severity} size="sm" />
                                    <div className="text-sm font-medium">
                                      {scenario.name}
                                    </div>
                                  </div>
                                  <p className="text-sm leading-6 text-muted-foreground">
                                    {scenario.description}
                                  </p>
                                </div>
                                <Badge variant="outline" className="shrink-0">
                                  {scenario.steps.length}단계
                                </Badge>
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  disabled={runningScenario !== null || stopping}
                                  onClick={() => handleRunScenario(scenario.id)}
                                >
                                  {runningScenario === scenario.id ? (
                                    <Spinner size={12} />
                                  ) : (
                                    <Play size={12} />
                                  )}
                                  실행
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                {injections.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                    아직 주입 이력이 없습니다
                  </div>
                ) : (
                  <ScrollArea className="h-[480px] pr-3">
                    <div className="space-y-3">
                      {injections.map((injection) => (
                        <Card key={injection.id} size="sm" className="shadow-none">
                          <CardContent className="space-y-3 pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                                  injectionBadgeClass[injection.classification],
                                )}
                              >
                                {injection.classification}
                              </Badge>
                              <code className="rounded bg-muted px-2 py-1 text-xs text-primary sm:text-sm">
                                {injection.request.canId}
                              </code>
                              {injection.request.label && (
                                <Badge variant="secondary" className="max-w-full truncate">
                                  {injection.request.label}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div>
                                TX: <code className="font-mono text-foreground">{injection.request.data}</code>
                              </div>
                              {injection.ecuResponse.data && (
                                <div>
                                  RX: <code className="font-mono text-foreground">{injection.ecuResponse.data}</code>
                                </div>
                              )}
                              {injection.ecuResponse.delayMs != null && (
                                <div className="text-xs">
                                  응답 지연 {injection.ecuResponse.delayMs}ms
                                </div>
                              )}
                            </div>
                            {injection.ecuResponse.error && (
                              <Alert variant="destructive">
                                <AlertTriangle size={16} />
                                <AlertTitle>ECU 응답 오류</AlertTitle>
                                <AlertDescription>
                                  {injection.ecuResponse.error}
                                </AlertDescription>
                              </Alert>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
