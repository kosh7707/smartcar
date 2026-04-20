import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttackScenario, CanInjectionResponse, CanMessage, DynamicAlert, DynamicAnalysisSession, InjectionClassification, WsMessage as SharedWsMessage } from "@aegis/shared";
import { AlertTriangle, Pause, Play, Plug, Radio, Send, Square, Wifi, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fetchInjections, fetchScenarios, getWsBaseUrl, injectCanMessage, injectScenario, logError, stopDynamicSession } from "../../../api/client";
import { useToast } from "../../../contexts/ToastContext";
import { BackButton, ConnectionStatusBanner, SeverityBadge, Spinner } from "../../../shared/ui";
import { formatTime } from "../../../utils/format";
import { createReconnectingWs, parseWsMessage, type ConnectionState } from "../../../utils/wsEnvelope";

const MAX_MESSAGES = 500;

const injectionBadgeClass: Record<InjectionClassification, string> = {
  normal: "monitoring-injection-badge monitoring-injection-badge--normal",
  crash: "monitoring-injection-badge monitoring-injection-badge--crash",
  anomaly: "monitoring-injection-badge monitoring-injection-badge--anomaly",
  timeout: "monitoring-injection-badge monitoring-injection-badge--timeout",
};

const tableHeadClass = "monitoring-table-head";
const cellMonoClass = "monitoring-cell-data";

type PanelTab = "alerts" | "inject" | "history";

interface Props {
  session: DynamicAnalysisSession;
  onBack: () => void;
  onStopped: () => void;
}

export const MonitoringView: React.FC<Props> = ({ session, onBack, onStopped }) => {
  const [messages, setMessages] = useState<CanMessage[]>([]);
  const [alerts, setAlerts] = useState<DynamicAlert[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnectionState, setWsConnectionState] = useState<ConnectionState>("disconnected");
  const [stopping, setStopping] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const bufferRef = useRef<CanMessage[]>([]);
  const [activeTab, setActiveTab] = useState<PanelTab>("alerts");
  const [scenarios, setScenarios] = useState<AttackScenario[]>([]);
  const [injections, setInjections] = useState<CanInjectionResponse[]>([]);
  const [injForm, setInjForm] = useState({ canId: "", dlc: 8, data: "", label: "" });
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
                if (bufferedMessages.length > MAX_MESSAGES) bufferRef.current = bufferedMessages.slice(-MAX_MESSAGES);
              } else {
                setMessages((previous) => {
                  const next = [...previous, msg.payload];
                  return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
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
    fetchScenarios().then(setScenarios).catch((error) => logError("Load scenarios", error));
    fetchInjections(session.id).then((data) => setInjections([...data].reverse())).catch((error) => logError("Load injections", error));
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

  const flaggedMessages = useMemo(() => messages.filter((message) => message.flagged), [messages]);

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
      const result = await injectCanMessage(session.id, { canId: injForm.canId.trim(), dlc: injForm.dlc, data: injForm.data.trim(), label: injForm.label.trim() || undefined });
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
      setInjError(error instanceof Error ? error.message : "시나리오 실행 실패");
    } finally {
      setRunningScenario(null);
    }
  };

  return (
    <div className="monitoring-shell">
      <ConnectionStatusBanner connectionState={wsConnectionState} />
      <BackButton onClick={onBack} label="세션 목록으로" />

      <Card className="monitoring-status-card">
        <CardContent>
          <div className="monitoring-status-row">
            <div className="monitoring-status-badges">
              <Badge
                variant="outline"
                className={cn(
                  "monitoring-connection-badge",
                  wsConnected
                    ? "monitoring-connection-badge--connected"
                    : "monitoring-connection-badge--disconnected",
                )}
              >
                {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {wsConnected ? "연결됨" : "연결 끊김"}
              </Badge>
              <Badge variant="outline" className="monitoring-status-badge"><Plug size={12} />{session.source.adapterName ?? "어댑터"}</Badge>
              <Badge variant="outline" className="monitoring-status-badge"><Radio size={12} /> 메시지 {messageCount || messages.length}</Badge>
              <Badge variant="outline" className="monitoring-status-badge"><AlertTriangle size={12} /> 알림 {alertCount || alerts.length}</Badge>
            </div>
            <Button variant="destructive" className="monitoring-stop" onClick={handleStop} disabled={stopping}>{stopping ? <Spinner size={14} /> : <Square size={14} />}세션 종료</Button>
          </div>
        </CardContent>
      </Card>

      {!hasData ? (
        <Card className="monitoring-empty-card">
          <CardContent>
            <div className="monitoring-empty-icon"><Plug size={32} /></div>
            <div className="monitoring-empty-copy">
              <h3 className="monitoring-empty-title">어댑터에서 데이터 대기 중...</h3>
              <p className="monitoring-empty-body">ECU 시뮬레이터 또는 실 ECU가 어댑터에 연결되면 CAN 데이터 수신이 시작됩니다.<br />또는 아래 <strong>CAN 주입</strong> 탭에서 직접 메시지를 전송할 수 있습니다.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="monitoring-grid">
        <div className="monitoring-left">
          <Card>
            <CardHeader className="monitoring-card-head">
              <div>
                <CardTitle>CAN 메시지</CardTitle>
                <CardDescription>최근 {Math.min(messages.length, MAX_MESSAGES)}개의 메시지를 실시간으로 표시합니다.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className={cn("monitoring-toggle", paused && "is-paused")} onClick={() => setPaused((previous) => !previous)}>
                {paused ? <Play size={12} /> : <Pause size={12} />}
                {paused ? "재개" : "일시정지"}
              </Button>
            </CardHeader>
            <CardContent>
              <div ref={canWrapperRef} className="monitoring-stream-wrap">
                <Table>
                  <TableHeader className={tableHeadClass}>
                    <TableRow>
                      <TableHead className={tableHeadClass}>시간</TableHead>
                      <TableHead className={tableHeadClass}>CAN ID</TableHead>
                      <TableHead className="monitoring-table-head monitoring-table-head--center">DLC</TableHead>
                      <TableHead className={tableHeadClass}>데이터</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="monitoring-waiting">CAN 메시지 대기 중...</TableCell></TableRow>
                    ) : messages.map((message, index) => (
                      <TableRow key={index} className={cn(message.flagged && "monitoring-row-flagged", message.injected && !message.flagged && "monitoring-row-injected")}>
                        <TableCell className="monitoring-cell-time">{formatTime(message.timestamp)}</TableCell>
                        <TableCell className="monitoring-cell-id">
                          <div className="monitoring-cell-id-wrap">
                            {message.injected ? <Badge className="monitoring-cell-injected-badge">INJ</Badge> : null}
                            <span>{message.id}</span>
                          </div>
                        </TableCell>
                        <TableCell className="monitoring-cell-center">{message.dlc}</TableCell>
                        <TableCell className={cellMonoClass}>{message.data}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {flaggedMessages.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="monitoring-flagged-title"><AlertTriangle size={14} /> 알림 패킷 ({flaggedMessages.length})</CardTitle>
                <CardDescription>탐지 규칙에 의해 표시된 패킷만 별도로 모아 보여줍니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="monitoring-side-scroll-flagged">
                  <Table>
                    <TableHeader className={tableHeadClass}>
                      <TableRow>
                        <TableHead className={tableHeadClass}>시간</TableHead>
                        <TableHead className={tableHeadClass}>CAN ID</TableHead>
                        <TableHead className="monitoring-table-head monitoring-table-head--center">DLC</TableHead>
                        <TableHead className={tableHeadClass}>데이터</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flaggedMessages.map((message, index) => (
                        <TableRow key={index} className="monitoring-row-flagged">
                          <TableCell className="monitoring-cell-time">{formatTime(message.timestamp)}</TableCell>
                          <TableCell className="monitoring-cell-id monitoring-cell-id--flagged">{message.id}</TableCell>
                          <TableCell className="monitoring-cell-center">{message.dlc}</TableCell>
                          <TableCell className={cellMonoClass}>{message.data}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="monitoring-side-card">
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PanelTab)} className="monitoring-tabs-shell">
              <TabsList variant="line" className="monitoring-tabs">
                <TabsTrigger value="alerts" className="monitoring-tab">알림{alerts.length > 0 ? <Badge variant="secondary" className="monitoring-tab-badge">{alerts.length}</Badge> : null}</TabsTrigger>
                <TabsTrigger value="inject" className="monitoring-tab">CAN 주입</TabsTrigger>
                <TabsTrigger value="history" className="monitoring-tab">주입 이력{injections.length > 0 ? <Badge variant="secondary" className="monitoring-tab-badge">{injections.length}</Badge> : null}</TabsTrigger>
              </TabsList>

              <TabsContent value="alerts" className="monitoring-tab-panel">
                {alerts.length === 0 ? (
                  <div className="monitoring-tab-empty">아직 탐지된 이상이 없습니다</div>
                ) : (
                  <ScrollArea className="monitoring-side-scroll-alerts">
                    <div className="monitoring-alert-list">
                      {alerts.map((alert) => (
                        <Alert key={alert.id} className="monitoring-alert">
                          <AlertTriangle size={16} className="monitoring-alert-icon" />
                          <div className="monitoring-alert-body">
                            <div>
                              <div className="monitoring-alert-head">
                                <SeverityBadge severity={alert.severity} size="sm" />
                                <AlertTitle>{alert.title}</AlertTitle>
                              </div>
                              <AlertDescription>{alert.description}</AlertDescription>
                            </div>
                            {alert.llmAnalysis ? <div className="monitoring-alert-llm"><Badge variant="outline" className="monitoring-llm-badge">LLM</Badge><p className="finding-body-text">{alert.llmAnalysis}</p></div> : null}
                            <div className="monitoring-alert-time">{formatTime(alert.detectedAt)}</div>
                          </div>
                        </Alert>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="inject" className="monitoring-tab-panel">
                <form onSubmit={handleInject} className="monitoring-inject-form">
                  <div className="monitoring-inject-grid">
                    <Label className="monitoring-field"><span className="monitoring-field-label">CAN ID</span><Input value={injForm.canId} onChange={(event) => setInjForm((previous) => ({ ...previous, canId: event.target.value }))} placeholder="0x7DF" /></Label>
                    <Label className="monitoring-field"><span className="monitoring-field-label">DLC</span><Input type="number" min={0} max={8} value={injForm.dlc} onChange={(event) => setInjForm((previous) => ({ ...previous, dlc: Number(event.target.value) }))} /></Label>
                  </div>
                  <Label className="monitoring-field"><span className="monitoring-field-label">Data</span><Input className="monitoring-field-mono" value={injForm.data} onChange={(event) => setInjForm((previous) => ({ ...previous, data: event.target.value }))} placeholder="FF FF FF FF FF FF FF FF" /></Label>
                  <Label className="monitoring-field"><span className="monitoring-field-label">Label (선택)</span><Input value={injForm.label} onChange={(event) => setInjForm((previous) => ({ ...previous, label: event.target.value }))} placeholder="Diagnostic Request" /></Label>
                  <Button type="submit" disabled={injecting || !injForm.canId.trim() || !injForm.data.trim() || stopping}>{injecting ? <Spinner size={14} /> : <Send size={14} />}주입</Button>
                </form>

                {injError ? <Alert variant="destructive"><AlertTriangle size={16} /><AlertTitle>주입 요청 실패</AlertTitle><AlertDescription>{injError}</AlertDescription></Alert> : null}

                <div className="monitoring-scenario-list">
                  <div>
                    <div className="dynamic-test-section-title">공격 시나리오</div>
                    <p className="dynamic-test-option-desc">준비된 시나리오를 실행해 ECU 응답을 비교합니다.</p>
                  </div>
                  <ScrollArea className="monitoring-side-scroll-scenarios">
                    <div className="monitoring-scenario-list">
                      {scenarios.length === 0 ? (
                        <div className="monitoring-tab-empty">로딩 중...</div>
                      ) : scenarios.map((scenario) => (
                        <Card key={scenario.id} size="sm" className="monitoring-scenario-card">
                          <CardContent>
                            <div className="monitoring-scenario-head">
                              <div className="monitoring-scenario-copy">
                                <div className="monitoring-scenario-title"><SeverityBadge severity={scenario.severity} size="sm" /> <span>{scenario.name}</span></div>
                                <p className="monitoring-scenario-desc">{scenario.description}</p>
                              </div>
                              <Badge variant="outline">{scenario.steps.length}단계</Badge>
                            </div>
                            <div className="monitoring-scenario-actions"><Button size="sm" disabled={runningScenario !== null || stopping} onClick={() => handleRunScenario(scenario.id)}>{runningScenario === scenario.id ? <Spinner size={12} /> : <Play size={12} />}실행</Button></div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="history" className="monitoring-tab-panel">
                {injections.length === 0 ? (
                  <div className="monitoring-tab-empty">아직 주입 이력이 없습니다</div>
                ) : (
                  <ScrollArea className="monitoring-side-scroll-history">
                    <div className="monitoring-injection-list">
                      {injections.map((injection) => (
                        <Card key={injection.id} size="sm" className="monitoring-injection-card">
                          <CardContent>
                            <div className="monitoring-injection-head">
                              <Badge variant="outline" className={injectionBadgeClass[injection.classification]}>{injection.classification}</Badge>
                              <code className="monitoring-injection-code">{injection.request.canId}</code>
                              {injection.request.label ? <Badge variant="secondary">{injection.request.label}</Badge> : null}
                            </div>
                            <div className="monitoring-injection-copy">
                              <div>TX: <code>{injection.request.data}</code></div>
                              {injection.ecuResponse.data ? <div>RX: <code>{injection.ecuResponse.data}</code></div> : null}
                              {injection.ecuResponse.delayMs != null ? <div className="monitoring-injection-delay">응답 지연 {injection.ecuResponse.delayMs}ms</div> : null}
                            </div>
                            {injection.ecuResponse.error ? <Alert variant="destructive"><AlertTriangle size={16} /><AlertTitle>ECU 응답 오류</AlertTitle><AlertDescription>{injection.ecuResponse.error}</AlertDescription></Alert> : null}
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
