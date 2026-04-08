import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { DynamicAnalysisSession } from "@aegis/shared";
import { Activity, Plus, Radio, AlertTriangle, Trash2, Plug } from "lucide-react";
import {
  createDynamicSession,
  fetchDynamicSessions,
  startDynamicSession,
  stopDynamicSession,
  ApiError,
  logError,
} from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { MonitoringView } from "../components/dynamic/MonitoringView";
import { SessionDetailView } from "../components/dynamic/SessionDetailView";
import { PageHeader, EmptyState, ConfirmDialog, ListItem, Spinner, AdapterSelector, BackButton } from "../components/ui";
import { useAdapters } from "../hooks/useAdapters";
import { formatDateTime } from "../utils/format";
import { STATUS_LABELS } from "../constants/dynamic";
import "./DynamicAnalysisPage.css";

export const DynamicAnalysisPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const { connected, hasConnected } = useAdapters(projectId);
  const toast = useToast();
  const [sessions, setSessions] = useState<DynamicAnalysisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [adapterWarning, setAdapterWarning] = useState(false);
  const [selectedAdapterId, setSelectedAdapterId] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);

  // View state
  const [activeSession, setActiveSession] = useState<DynamicAnalysisSession | null>(null);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    if (!projectId) return;
    fetchDynamicSessions(projectId)
      .then(setSessions)
      .catch((e) => {
        logError("Load sessions", e);
        const retry = e instanceof ApiError && e.retryable ? { label: "다시 시도", onClick: loadSessions } : undefined;
        toast.error(e instanceof Error ? e.message : "세션 목록을 불러올 수 없습니다.", retry);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Check if there's already an active (monitoring) session
  useEffect(() => {
    const monitoring = sessions.find((s) => s.status === "monitoring");
    if (monitoring) {
      setActiveSession(monitoring);
    }
  }, [sessions]);

  const handleCreateSession = async (adapterId: string) => {
    if (!projectId) return;
    setCreating(true);
    try {
      const session = await createDynamicSession(projectId, adapterId);
      const started = await startDynamicSession(session.id);
      setActiveSession(started);
    } catch (e) {
      logError("Create session", e);
      const retry = e instanceof ApiError && e.retryable ? { label: "다시 시도", onClick: () => handleCreateSession(adapterId) } : undefined;
      toast.error(e instanceof Error ? e.message : "세션 생성에 실패했습니다.", retry);
    } finally {
      setCreating(false);
      setShowSelector(false);
      setSelectedAdapterId(null);
    }
  };

  const handleNewSessionClick = () => {
    if (!hasConnected) {
      setAdapterWarning(true);
      return;
    }
    setAdapterWarning(false);
    setShowSelector(true);
    if (connected.length === 1) {
      setSelectedAdapterId(connected[0].id);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      await stopDynamicSession(sessionId);
    } catch (e) {
      logError("Stop session", e);
      toast.error("세션 종료에 실패했습니다.");
    }
  };

  const handleSessionStopped = () => {
    setActiveSession(null);
    loadSessions();
  };

  const handleSessionClick = (session: DynamicAnalysisSession) => {
    if (session.status === "monitoring") {
      setActiveSession(session);
    } else {
      setViewingSessionId(session.id);
    }
  };

  // Active monitoring view
  if (activeSession) {
    return (
      <MonitoringView
        session={activeSession}
        onBack={() => {
          setActiveSession(null);
          loadSessions();
        }}
        onStopped={handleSessionStopped}
      />
    );
  }

  // Session detail view
  if (viewingSessionId) {
    return (
      <SessionDetailView
        sessionId={viewingSessionId}
        onBack={() => {
          setViewingSessionId(null);
          loadSessions();
        }}
      />
    );
  }

  // New session config view
  if (showSelector) {
    return (
      <div className="page-enter">
        <BackButton onClick={() => { setShowSelector(false); setSelectedAdapterId(null); }} label="이력으로" />
        <PageHeader title="새 세션" icon={<Activity size={20} />} />

        <div className="card dyn-config">
          {/* Adapter */}
          <div className="dyn-config__section">
            <label className="dyn-config__label">어댑터</label>
            {connected.length === 0 ? (
              <p className="dyn-config__hint" style={{ color: "var(--cds-support-error)" }}>
                연결된 어댑터가 없습니다.{" "}
                <a href={`#/projects/${projectId}/settings`}>프로젝트 설정</a>에서 연결해주세요.
              </p>
            ) : (
              <AdapterSelector
                adapters={connected}
                selectedId={selectedAdapterId}
                onSelect={setSelectedAdapterId}
                disabled={creating}
              />
            )}
          </div>

          {/* Mode info */}
          <div className="dyn-config__section">
            <label className="dyn-config__label">모니터링 모드</label>
            <div className="dyn-config__mode-card">
              <Radio size={16} />
              <div>
                <div className="dyn-config__mode-title">실시간 CAN 트래픽 모니터링</div>
                <p className="dyn-config__mode-desc">
                  어댑터를 통해 CAN 버스 트래픽을 실시간으로 수집하고, 이상 패턴을 탐지합니다.
                  세션 종료 시 수집된 메시지와 알림 이력이 저장됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="dyn-config__actions">
            <button
              className="btn"
              disabled={!selectedAdapterId || creating}
              onClick={() => selectedAdapterId && handleCreateSession(selectedAdapterId)}
            >
              {creating ? <Spinner size={14} /> : <Radio size={16} />}
              모니터링 시작
            </button>
          </div>
        </div>

        {creating && (
          <div className="centered-loader--compact">
            <Spinner label="세션 생성 중..." />
          </div>
        )}
      </div>
    );
  }

  // Default: session history
  return (
    <div className="page-enter">
      <PageHeader
        title="동적 분석"
        icon={<Activity size={20} />}
        action={
          <button className="btn" onClick={handleNewSessionClick} disabled={creating}>
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

      {loading ? (
        <div className="centered-loader--compact">
          <Spinner label="세션 이력 로딩 중..." />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} />}
          title="아직 동적 분석 이력이 없습니다"
          description="CAN 트래픽을 실시간으로 모니터링하고 이상을 탐지합니다"
          action={
            <button className="btn" onClick={handleNewSessionClick} disabled={creating}>
              첫 세션 시작
            </button>
          }
        />
      ) : (
        <div className="card">
          {sessions.map((s) => (
            <ListItem
              key={s.id}
              onClick={() => handleSessionClick(s)}
              trailing={
                <>
                  <span className="analysis-item__time">{formatDateTime(s.startedAt)}</span>
                  {s.status === "monitoring" && (
                    <button
                      className="btn-icon btn-danger"
                      title="종료"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmStopId(s.id);
                      }}
                    >
                      <Activity size={14} />
                    </button>
                  )}
                  {s.status === "stopped" && (
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
                  <span className={`analysis-item__badge analysis-item__badge--${s.status}`}>
                    <Activity size={11} />
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <span className="analysis-item__badge">
                    <Plug size={11} />
                    {s.source.adapterName ?? "어댑터"}
                  </span>
                  <span className="analysis-item__stat">
                    <Radio size={12} /> {s.messageCount}건
                  </span>
                  <span className="analysis-item__stat">
                    <AlertTriangle size={12} /> {s.alertCount}건
                  </span>
                </div>
                {s.endedAt && (
                  <div className="analysis-item__sub">
                    종료: {formatDateTime(s.endedAt)}
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
        onConfirm={() => { if (confirmStopId) handleStopSession(confirmStopId).then(loadSessions); setConfirmStopId(null); }}
        onCancel={() => setConfirmStopId(null)}
      />
    </div>
  );
};
