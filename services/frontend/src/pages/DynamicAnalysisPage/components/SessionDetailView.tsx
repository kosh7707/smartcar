import React, { useEffect, useMemo, useState } from "react";
import type { CanMessage, DynamicAlert, DynamicAnalysisSession } from "@aegis/shared";
import { AlertTriangle, Clock, Plug, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchDynamicSessionDetail, logError } from "../../../api/client";
import { STATUS_LABELS } from "../../../constants/dynamic";
import { useToast } from "../../../contexts/ToastContext";
import { BackButton, EmptyState, SeverityBadge, Spinner } from "../../../shared/ui";
import { formatDateTime, formatTime } from "../../../utils/format";

const tableHeadClass = "dynamic-session-table-head";

const getSessionStatusClass = (status: string) =>
  ({
    monitoring: "dynamic-status-badge dynamic-status-badge--monitoring",
    stopped: "dynamic-status-badge dynamic-status-badge--stopped",
    connected: "dynamic-status-badge dynamic-status-badge--connected",
  }[status] ?? "dynamic-status-badge dynamic-status-badge--default");

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
              value: <span className={cn("dynamic-session-summary-status", getSessionStatusClass(session.status))}>{STATUS_LABELS[session.status] ?? session.status}</span>,
            },
            { label: "시작", icon: <Clock size={14} />, value: formatDateTime(session.startedAt) },
            ...(session.endedAt ? [{ label: "종료", icon: <Clock size={14} />, value: formatDateTime(session.endedAt) }] : []),
            { label: "소스", icon: <Plug size={14} />, value: session.source.adapterName ?? "어댑터" },
            { label: "메시지", icon: <Radio size={14} />, value: `${session.messageCount}건` },
            { label: "알림", icon: <AlertTriangle size={14} />, value: `${session.alertCount}건` },
          ]
        : [],
    [session],
  );

  if (loading) {
    return <div className="page-loading-shell dynamic-session-loading"><Spinner size={36} label="세션 정보 로딩 중..." /></div>;
  }

  if (!session) {
    return (
      <div className="dynamic-session-shell dynamic-session-empty">
        <BackButton onClick={onBack} label="세션 목록으로" />
        <p className="dynamic-session-empty-copy">세션을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="dynamic-session-shell">
      <BackButton onClick={onBack} label="세션 목록으로" />

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">세션 요약</h3>
          <p className="panel-description">동적 분석 세션의 상태, 시간 정보, 수집된 메시지 규모를 확인합니다.</p>
        </div>
        <div className="panel-body">
          <div className="dynamic-session-summary-grid">
            {summaryItems.map((item) => (
              <div className="panel dynamic-session-summary-item" key={item.label}>
                <div className="panel-body">
                  {item.icon ? <div className="dynamic-session-summary-icon">{item.icon}</div> : null}
                  <div className="dynamic-session-summary-copy">
                    <div className="dynamic-session-summary-label">{item.label}</div>
                    <div className="dynamic-session-summary-value">{item.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">탐지 알림 ({alerts.length})</h3>
          <p className="panel-description">세션 중 기록된 이상 징후와 LLM 해석 결과를 확인합니다.</p>
        </div>
        <div className="panel-body">
          {alerts.length === 0 ? (
            <EmptyState compact title="탐지된 이상이 없습니다" />
          ) : (
            <div className="scroll-area dynamic-session-alert-scroll">
              <div className="dynamic-session-alert-list">
                {alerts.map((alert) => (
                  <div className="panel panel-alert dynamic-session-alert" key={alert.id}>
                    <AlertTriangle size={16} className="dynamic-session-alert-icon" />
                    <div className="dynamic-session-alert-body">
                      <div>
                        <div className="dynamic-session-alert-head">
                          <SeverityBadge severity={alert.severity} />
                          <strong className="alert-title">{alert.title}</strong>
                        </div>
                        <span className="alert-description">{alert.description}</span>
                      </div>
                      {alert.llmAnalysis ? (
                        <div className="dynamic-session-alert-llm">
                          <span className="dynamic-session-llm-badge">LLM</span>
                          <p className="finding-body-text">{alert.llmAnalysis}</p>
                        </div>
                      ) : null}
                      <div className="dynamic-session-alert-time">{formatTime(alert.detectedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">CAN 메시지 (최근 {messages.length}건)</h3>
          <p className="panel-description">세션 종료 시점 기준으로 저장된 최근 CAN 패킷을 표시합니다.</p>
        </div>
        <div className="panel-body">
          {messages.length === 0 ? (
            <EmptyState compact title="수신된 메시지가 없습니다" />
          ) : (
            <div className="scroll-area dynamic-session-message-scroll">
              <table className="data-table">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className={tableHeadClass}>시간</th>
                    <th className={tableHeadClass}>CAN ID</th>
                    <th className="dynamic-session-table-head dynamic-session-table-head--center">DLC</th>
                    <th className={tableHeadClass}>데이터</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((message, index) => (
                    <tr key={index} className={cn(message.flagged && "dynamic-session-table-flagged")}>
                      <td className="dynamic-session-table-time">{formatTime(message.timestamp)}</td>
                      <td className="dynamic-session-table-id">{message.id}</td>
                      <td className="dynamic-session-table-center">{message.dlc}</td>
                      <td className="dynamic-session-table-data">{message.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
