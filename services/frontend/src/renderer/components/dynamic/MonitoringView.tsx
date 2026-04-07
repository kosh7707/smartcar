import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type {
  CanMessage,
  DynamicAlert,
  DynamicAnalysisSession,
  WsMessage,
  CanInjectionResponse,
  AttackScenario,
  InjectionClassification,
} from "@aegis/shared";
import { Square, Radio, AlertTriangle, Wifi, WifiOff, Plug, Send, Play, Pause } from "lucide-react";
import {
  getWsBaseUrl,
  stopDynamicSession,
  fetchScenarios,
  injectCanMessage,
  injectScenario,
  fetchInjections,
  logError,
} from "../../api/client";
import { parseWsMessage } from "../../utils/wsEnvelope";
import { BackButton, SeverityBadge, Spinner } from "../ui";
import { useToast } from "../../contexts/ToastContext";
import { formatTime } from "../../utils/format";

const MAX_MESSAGES = 500;

const CLASSIFICATION_COLOR: Record<InjectionClassification, string> = {
  normal: "var(--success)",
  crash: "var(--danger)",
  anomaly: "var(--severity-medium)",
  timeout: "var(--severity-low)",
};

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
  const [stopping, setStopping] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const bufferRef = useRef<CanMessage[]>([]);

  // Injection state
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

  // Connect WebSocket
  useEffect(() => {
    const wsUrl = getWsBaseUrl();
    const ws = new WebSocket(`${wsUrl}/ws/dynamic-analysis?sessionId=${session.id}`);

    ws.onopen = () => { console.info("[WS:dynamic-analysis] connected"); setWsConnected(true); };
    ws.onclose = (e) => { console.info(`[WS:dynamic-analysis] closed (code: ${e.code})`); setWsConnected(false); };
    ws.onerror = () => { console.warn("[WS:dynamic-analysis] error"); setWsConnected(false); };

    ws.onmessage = (event) => {
      try {
        const msg = parseWsMessage(event.data) as unknown as WsMessage;
        switch (msg.type) {
          case "message":
            if (pausedRef.current) {
              const buf = bufferRef.current;
              buf.push(msg.payload);
              if (buf.length > MAX_MESSAGES) bufferRef.current = buf.slice(-MAX_MESSAGES);
            } else {
              setMessages((prev) => {
                const next = [...prev, msg.payload];
                return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
              });
            }
            break;
          case "alert":
            setAlerts((prev) => [msg.payload, ...prev]);
            break;
          case "status":
            setMessageCount(msg.payload.messageCount);
            setAlertCount(msg.payload.alertCount);
            break;
          case "injection-result":
            setInjections((prev) => [msg.payload, ...prev]);
            break;
          case "injection-error":
            setInjError(msg.payload.error);
            break;
        }
      } catch (e) {
        console.warn("[WS:dynamic-analysis] malformed message:", e);
      }
    };

    wsRef.current = ws;
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [session.id]);

  // Load scenarios + initial injection history
  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch((e) => logError("Load scenarios", e));
    fetchInjections(session.id)
      .then((data) => setInjections([...data].reverse()))
      .catch((e) => logError("Load injections", e));
  }, [session.id]);

  // Keep pausedRef in sync
  useEffect(() => {
    pausedRef.current = paused;
    if (!paused && bufferRef.current.length > 0) {
      // Resume: flush buffer into messages
      const buffered = bufferRef.current;
      bufferRef.current = [];
      setMessages((prev) => {
        const next = [...prev, ...buffered];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    }
  }, [paused]);

  // Auto-scroll when not paused
  useEffect(() => {
    if (!paused && canWrapperRef.current) {
      canWrapperRef.current.scrollTop = canWrapperRef.current.scrollHeight;
    }
  }, [messages, paused]);

  // Flagged messages
  const flaggedMessages = useMemo(
    () => messages.filter((m) => m.flagged),
    [messages],
  );

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      wsRef.current?.close();
      await stopDynamicSession(session.id);
      onStopped();
    } catch (e) {
      logError("Stop session", e);
      toast.error("세션 종료에 실패했습니다.");
      setStopping(false);
    }
  }, [session.id, onStopped]);

  const handleInject = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setInjections((prev) => [result, ...prev]);
    } catch (err) {
      setInjError(err instanceof Error ? err.message : "주입 실패");
    } finally {
      setInjecting(false);
    }
  };

  const handleRunScenario = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    setInjError(null);
    try {
      const results = await injectScenario(session.id, scenarioId);
      setInjections((prev) => [...[...results].reverse(), ...prev]);
    } catch (err) {
      setInjError(err instanceof Error ? err.message : "시나리오 실행 실패");
    } finally {
      setRunningScenario(null);
    }
  };

  return (
    <div className="page-enter">
      <BackButton onClick={onBack} label="세션 목록으로" />

      {/* Status bar */}
      <div className="monitor-status-bar">
        <div className="monitor-status-bar__left">
          <div className="monitor-status-indicator">
            {wsConnected ? (
              <>
                <Wifi size={14} className="monitor-status-icon--connected" />
                <span className="monitor-status-text--connected">연결됨</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="monitor-status-icon--disconnected" />
                <span>연결 끊김</span>
              </>
            )}
          </div>
          <div className="monitor-source-tag">
            <Plug size={12} />
            <span>{session.source.adapterName ?? "어댑터"}</span>
          </div>
          <div className="monitor-stat">
            <Radio size={12} />
            <span>메시지 {messageCount || messages.length}</span>
          </div>
          <div className="monitor-stat">
            <AlertTriangle size={12} />
            <span>알림 {alertCount || alerts.length}</span>
          </div>
        </div>
        <button
          className="btn btn-stop"
          onClick={handleStop}
          disabled={stopping}
        >
          {stopping ? <Spinner size={14} /> : <Square size={14} />}
          세션 종료
        </button>
      </div>

      {/* Waiting for data */}
      {!hasData && (
        <div className="card dyn-external-waiting">
          <div className="dyn-external-waiting__icon">
            <Plug size={32} />
          </div>
          <h3 className="dyn-external-waiting__title">어댑터에서 데이터 대기 중...</h3>
          <p className="dyn-external-waiting__desc">
            ECU 시뮬레이터 또는 실 ECU가 어댑터에 연결되면 CAN 데이터 수신이 시작됩니다.
            <br />
            또는 아래 <strong>CAN 주입</strong> 탭에서 직접 메시지를 전송할 수 있습니다.
          </p>
        </div>
      )}

      {/* Main content: messages + tabbed right panel */}
      <div className="monitor-layout">
        {/* CAN Messages */}
        <div className="monitor-messages">
          <div className="card">
            <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              CAN 메시지
              <button
                className={`btn-secondary btn-sm monitor-pause-btn${paused ? " monitor-pause-btn--active" : ""}`}
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? <Play size={12} /> : <Pause size={12} />}
                {paused ? "재개" : "일시정지"}
              </button>
            </div>
            <div className="can-table-wrapper" ref={canWrapperRef}>
              <table className="can-table">
                <thead>
                  <tr>
                    <th>시간</th>
                    <th>CAN ID</th>
                    <th>DLC</th>
                    <th>데이터</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="can-table__empty">
                        CAN 메시지 대기 중...
                      </td>
                    </tr>
                  ) : (
                    messages.map((msg, i) => (
                      <tr
                        key={i}
                        className={
                          (msg.flagged ? "can-row--flagged" : "") +
                          (msg.injected ? " can-row--injected" : "")
                        }
                      >
                        <td className="can-cell--time">{formatTime(msg.timestamp)}</td>
                        <td className="can-cell--id">
                          {msg.injected && <span className="can-inject-tag">INJ</span>}
                          {msg.id}
                        </td>
                        <td className="can-cell--dlc">{msg.dlc}</td>
                        <td className="can-cell--data">{msg.data}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Flagged messages mini-table */}
          {flaggedMessages.length > 0 && (
            <div className="card flagged-panel">
              <div className="card-title flagged-panel__title">
                <AlertTriangle size={14} />
                알림 패킷 ({flaggedMessages.length})
              </div>
              <div className="flagged-panel__wrapper">
                <table className="can-table">
                  <thead>
                    <tr>
                      <th>시간</th>
                      <th>CAN ID</th>
                      <th>DLC</th>
                      <th>데이터</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedMessages.map((msg, i) => (
                      <tr key={i} className="can-row--flagged">
                        <td className="can-cell--time">{formatTime(msg.timestamp)}</td>
                        <td className="can-cell--id">{msg.id}</td>
                        <td className="can-cell--dlc">{msg.dlc}</td>
                        <td className="can-cell--data">{msg.data}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — Tabbed */}
        <div className="monitor-panel">
          <div className="card">
            <div className="monitor-panel-tabs">
              <button
                className={`monitor-panel-tab${activeTab === "alerts" ? " monitor-panel-tab--active" : ""}`}
                onClick={() => setActiveTab("alerts")}
              >
                알림
                {alerts.length > 0 && <span className="monitor-panel-tab__badge">{alerts.length}</span>}
              </button>
              <button
                className={`monitor-panel-tab${activeTab === "inject" ? " monitor-panel-tab--active" : ""}`}
                onClick={() => setActiveTab("inject")}
              >
                CAN 주입
              </button>
              <button
                className={`monitor-panel-tab${activeTab === "history" ? " monitor-panel-tab--active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                주입 이력
                {injections.length > 0 && <span className="monitor-panel-tab__badge">{injections.length}</span>}
              </button>
            </div>

            {/* Tab: Alerts */}
            {activeTab === "alerts" && (
              <>
                {alerts.length === 0 ? (
                  <p className="text-tertiary" style={{ padding: "var(--space-4) 0", textAlign: "center", fontSize: "var(--text-sm)" }}>
                    아직 탐지된 이상이 없습니다
                  </p>
                ) : (
                  <div className="alert-list">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="alert-card">
                        <div className="alert-card__header">
                          <SeverityBadge severity={alert.severity} size="sm" />
                          <span className="alert-card__title">{alert.title}</span>
                        </div>
                        <p className="alert-card__desc">{alert.description}</p>
                        {alert.llmAnalysis && (
                          <div className="alert-card__llm">
                            <span className="badge badge-info" style={{ fontSize: "var(--text-xs)" }}>LLM</span>
                            <p>{alert.llmAnalysis}</p>
                          </div>
                        )}
                        <span className="alert-card__time">{formatTime(alert.detectedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Tab: Injection */}
            {activeTab === "inject" && (
              <div className="inject-tab">
                {/* Raw injection form */}
                <form onSubmit={handleInject} className="inject-form">
                  <div className="inject-form__row">
                    <label className="form-field">
                      <span className="form-label">CAN ID</span>
                      <input
                        className="form-input"
                        value={injForm.canId}
                        onChange={(e) => setInjForm((p) => ({ ...p, canId: e.target.value }))}
                        placeholder="0x7DF"
                      />
                    </label>
                    <label className="form-field" style={{ maxWidth: 80 }}>
                      <span className="form-label">DLC</span>
                      <input
                        className="form-input"
                        type="number"
                        min={0}
                        max={8}
                        value={injForm.dlc}
                        onChange={(e) => setInjForm((p) => ({ ...p, dlc: Number(e.target.value) }))}
                      />
                    </label>
                  </div>
                  <label className="form-field">
                    <span className="form-label">Data</span>
                    <input
                      className="form-input form-input--mono"
                      value={injForm.data}
                      onChange={(e) => setInjForm((p) => ({ ...p, data: e.target.value }))}
                      placeholder="FF FF FF FF FF FF FF FF"
                    />
                  </label>
                  <label className="form-field">
                    <span className="form-label">Label (선택)</span>
                    <input
                      className="form-input"
                      value={injForm.label}
                      onChange={(e) => setInjForm((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Diagnostic Request"
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn"
                    disabled={injecting || !injForm.canId.trim() || !injForm.data.trim() || stopping}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {injecting ? <Spinner size={14} /> : <Send size={14} />}
                    주입
                  </button>
                </form>

                {injError && (
                  <div className="inject-error">
                    <AlertTriangle size={14} />
                    <span>{injError}</span>
                  </div>
                )}

                {/* Scenario cards */}
                <div className="inject-scenarios">
                  <div className="inject-scenarios__title">공격 시나리오</div>
                  {scenarios.length === 0 ? (
                    <p className="text-tertiary" style={{ fontSize: "var(--text-sm)", textAlign: "center", padding: "var(--space-3) 0" }}>
                      로딩 중...
                    </p>
                  ) : (
                    scenarios.map((s) => (
                      <div key={s.id} className="inject-scenario-card">
                        <div className="inject-scenario-card__header">
                          <SeverityBadge severity={s.severity} size="sm" />
                          <span className="inject-scenario-card__name">{s.name}</span>
                        </div>
                        <p className="inject-scenario-card__desc">{s.description}</p>
                        <div className="inject-scenario-card__footer">
                          <span className="inject-scenario-card__steps">{s.steps.length}단계</span>
                          <button
                            className="btn btn-sm"
                            disabled={runningScenario !== null || stopping}
                            onClick={() => handleRunScenario(s.id)}
                          >
                            {runningScenario === s.id ? <Spinner size={12} /> : <Play size={12} />}
                            실행
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Injection History */}
            {activeTab === "history" && (
              <div className="inject-history">
                {injections.length === 0 ? (
                  <p className="text-tertiary" style={{ padding: "var(--space-4) 0", textAlign: "center", fontSize: "var(--text-sm)" }}>
                    아직 주입 이력이 없습니다
                  </p>
                ) : (
                  injections.map((inj) => (
                    <div key={inj.id} className="inject-history-item">
                      <div className="inject-history-item__header">
                        <span
                          className="inject-history-item__badge"
                          style={{ color: CLASSIFICATION_COLOR[inj.classification] }}
                        >
                          {inj.classification}
                        </span>
                        <code className="inject-history-item__canid">{inj.request.canId}</code>
                        {inj.request.label && (
                          <span className="inject-history-item__label">{inj.request.label}</span>
                        )}
                      </div>
                      <div className="inject-history-item__detail">
                        <span>TX: <code>{inj.request.data}</code></span>
                        {inj.ecuResponse.data && <span>RX: <code>{inj.ecuResponse.data}</code></span>}
                        {inj.ecuResponse.delayMs != null && (
                          <span className="inject-history-item__delay">{inj.ecuResponse.delayMs}ms</span>
                        )}
                      </div>
                      {inj.ecuResponse.error && (
                        <div className="inject-history-item__error">{inj.ecuResponse.error}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
