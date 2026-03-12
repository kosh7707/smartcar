import React, { useEffect, useState } from "react";
import type { DynamicAnalysisSession, DynamicAlert, CanMessage } from "@smartcar/shared";
import { Clock, Radio, AlertTriangle, Plug } from "lucide-react";
import { fetchDynamicSessionDetail } from "../../api/client";
import { BackButton, SeverityBadge, Spinner } from "../ui";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/format";

interface Props {
  sessionId: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  connected: "대기",
  monitoring: "모니터링 중",
  stopped: "종료됨",
};

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
      .catch((e) => { console.error("Failed to load session:", e); toast.error("세션 정보를 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="page-enter" style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-16)" }}>
        <Spinner size={36} label="세션 정보 로딩 중..." />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-enter">
        <BackButton onClick={onBack} label="세션 목록으로" />
        <p className="text-tertiary">세션을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const formatTime = (ts: string) => {
    if (ts.includes("T")) {
      return ts.split("T")[1]?.replace("Z", "").slice(0, 12) ?? ts;
    }
    return ts;
  };

  return (
    <div className="page-enter">
      <BackButton onClick={onBack} label="세션 목록으로" />

      {/* Session info */}
      <div className="card session-info-card">
        <div className="session-info-grid">
          <div className="session-info-item">
            <span className="session-info-label">상태</span>
            <span className={`session-status session-status--${session.status}`}>
              {STATUS_LABELS[session.status] ?? session.status}
            </span>
          </div>
          <div className="session-info-item">
            <Clock size={14} />
            <span className="session-info-label">시작</span>
            <span>{formatDateTime(session.startedAt)}</span>
          </div>
          {session.endedAt && (
            <div className="session-info-item">
              <Clock size={14} />
              <span className="session-info-label">종료</span>
              <span>{formatDateTime(session.endedAt)}</span>
            </div>
          )}
          <div className="session-info-item">
            <Plug size={14} />
            <span className="session-info-label">소스</span>
            <span>어댑터</span>
          </div>
          <div className="session-info-item">
            <Radio size={14} />
            <span>메시지 {session.messageCount}건</span>
          </div>
          <div className="session-info-item">
            <AlertTriangle size={14} />
            <span>알림 {session.alertCount}건</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="card">
        <div className="card-title">탐지 알림 ({alerts.length})</div>
        {alerts.length === 0 ? (
          <p className="text-tertiary" style={{ padding: "var(--space-2) 0" }}>
            탐지된 이상이 없습니다
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
      </div>

      {/* Recent messages */}
      <div className="card">
        <div className="card-title">CAN 메시지 (최근 {messages.length}건)</div>
        {messages.length === 0 ? (
          <p className="text-tertiary" style={{ padding: "var(--space-2) 0" }}>
            수신된 메시지가 없습니다
          </p>
        ) : (
          <div className="can-table-wrapper can-table-wrapper--compact">
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
                {messages.map((msg, i) => (
                  <tr key={i} className={msg.flagged ? "can-row--flagged" : ""}>
                    <td className="can-cell--time">{formatTime(msg.timestamp)}</td>
                    <td className="can-cell--id">{msg.id}</td>
                    <td className="can-cell--dlc">{msg.dlc}</td>
                    <td className="can-cell--data">{msg.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
