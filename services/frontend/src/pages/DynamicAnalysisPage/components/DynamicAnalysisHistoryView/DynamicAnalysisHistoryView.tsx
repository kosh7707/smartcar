import "./DynamicAnalysisHistoryView.css";
import React, { useCallback, useEffect } from "react";
import type { DynamicAnalysisSession } from "@aegis/shared";
import { Activity, AlertTriangle, Plug, Plus, Radio, Trash2 } from "lucide-react";
import { cn } from "@/common/utils/cn";
import { ConnectionStatusBanner, ConfirmDialog, ListItem, PageHeader, Spinner } from "@/common/ui/primitives";
import { STATUS_LABELS } from "@/common/constants/dynamic";
import { formatDateTime } from "@/common/utils/format";
import type { ConnectionState } from "@/common/utils/wsEnvelope";

const ANALYSIS_BOOT_LINES = [
  { status: "ok" as const, slot: "aegis-monitor",    value: "loaded · kernel/can-v3" },
  { status: "ok" as const, slot: "can-decoder",      value: "0x000..0x7FF · 500kbps" },
  { status: "ok" as const, slot: "anomaly-engine",   value: "armed · detectors(12)" },
] as const;

interface DynamicAnalysisBootConsoleProps {
  hasConnected: boolean;
  onStart: () => void;
}

const DynamicAnalysisBootConsole: React.FC<DynamicAnalysisBootConsoleProps> = ({ hasConnected, onStart }) => {
  const handleKey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onStart();
      }
    },
    [onStart],
  );

  useEffect(() => {
    const globalHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onStart();
      }
    };
    document.addEventListener("keydown", globalHandler);
    return () => document.removeEventListener("keydown", globalHandler);
  }, [onStart]);

  const waitLine = hasConnected
    ? { slot: "bus-subscription", value: "no traffic on can0 · adapter ready" }
    : { slot: "adapter",          value: "no device on /dev/can0" };

  return (
    <section
      className="console-empty"
      tabIndex={0}
      role="group"
      aria-label="동적 분석 워크벤치 — 첫 세션 시작 대기"
      onKeyDown={handleKey}
    >
      <div className="console-empty__scanlines" aria-hidden="true" />
      <div className="console-empty__scope">
        <div className="console-empty__bar" aria-hidden="true">
          <span className="console-empty__bar-dot console-empty__bar-dot--r" />
          <span className="console-empty__bar-dot console-empty__bar-dot--y" />
          <span className="console-empty__bar-dot console-empty__bar-dot--g" />
          <span className="console-empty__bar-label">aegis@monitor:~#</span>
          <span className="console-empty__bar-meta">dmesg --follow</span>
        </div>
        <div className="console-empty__log" aria-hidden="true">
          {ANALYSIS_BOOT_LINES.map((line, i) => (
            <div
              key={line.slot}
              className="console-empty__line console-empty__line--in"
              
            >
              <span className="console-empty__status-chip console-empty__status-chip--ok">
                <span className="console-empty__bracket">[</span>
                <span className="console-empty__status console-empty__status--ok">OK</span>
                <span className="console-empty__bracket">]</span>
              </span>
              <span className="console-empty__slot">{line.slot}</span>
              <span className="console-empty__value">{line.value}</span>
            </div>
          ))}
          <div
            className="console-empty__line console-empty__line--in"
            
          >
            <span className="console-empty__status-chip console-empty__status-chip--wait">
              <span className="console-empty__bracket">[</span>
              <span className="console-empty__status console-empty__status--wait">WAIT</span>
              <span className="console-empty__bracket">]</span>
            </span>
            <span className="console-empty__slot">{waitLine.slot}</span>
            <span className="console-empty__value console-empty__value--warn">{waitLine.value}</span>
          </div>

          <div
            className="console-empty__prompt console-empty__line--in"
            
          >
            <span className="console-empty__tree">└─</span>
            <span>press</span>
            <kbd className="console-empty__kbd">↵ Enter</kbd>
            <span>to begin session</span>
            <span className="console-empty__cursor" aria-hidden="true">▊</span>
          </div>
        </div>

        <div className="console-empty__actions">
          <button
            type="button"
            className="console-empty__cta"
            onClick={onStart}
            aria-label="첫 세션 시작"
          >
            <span className="console-empty__cta-arrow">▸</span>
            <span>begin session</span>
            <span className="console-empty__cta-hint">[ ↵ ]</span>
          </button>
        </div>
      </div>
    </section>
  );
};

const getSessionBadgeClass = (status: string) =>
  ({
    monitoring: "dynamic-status-badge dynamic-status-badge--monitoring",
    stopped: "dynamic-status-badge dynamic-status-badge--stopped",
    connected: "dynamic-status-badge dynamic-status-badge--connected",
  }[status] ?? "dynamic-status-badge dynamic-status-badge--default");

interface DynamicAnalysisHistoryViewProps {
  projectId?: string;
  connectionState: ConnectionState;
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
    <ConnectionStatusBanner connectionState={connectionState} />
    <PageHeader
      title="동적 분석"
      action={
        <button type="button" className="btn btn-primary btn-sm"
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
        </button>
      }
    />

    {adapterWarning ? (
      <div className="console-alert" role="alert">
        <span className="console-alert__chip" aria-hidden="true">
          <span className="console-alert__bracket">[</span>
          <span className="console-alert__status">FAIL</span>
          <span className="console-alert__bracket">]</span>
        </span>
        <div className="console-alert__body">
          <div className="console-alert__row">
            <span className="console-alert__slot">can-adapter</span>
            <span className="console-alert__value">no device on /dev/can0 · bind required</span>
            <a
              className="console-alert__link"
              href={`#/projects/${projectId}/settings`}
              aria-label="프로젝트 설정으로 이동해 어댑터를 연결하세요"
            >
              <span className="console-alert__link-arrow" aria-hidden="true">└─</span>
              <span>bind › ./settings</span>
            </a>
          </div>
          <div className="console-alert__comment">
            # 연결된 어댑터가 없습니다 — 프로젝트 설정에서 어댑터를 연결해주세요.
          </div>
        </div>
      </div>
    ) : null}

    {historyLoading ? (
      <div className="page-loading-shell"><Spinner label="세션 이력 로딩 중..." /></div>
    ) : sessions.length === 0 ? (
      <DynamicAnalysisBootConsole
        hasConnected={hasConnected}
        onStart={() => {
          if (!hasConnected) {
            setAdapterWarning(true);
            return;
          }
          setAdapterWarning(false);
          onOpenConfig();
        }}
      />
    ) : (
      <div className="panel dynamic-history-list-card">
        <div className="panel-body">
          {sessions.map((session, index) => (
            <ListItem
              key={session.id}
              onClick={() => onOpenSession(session)}
              divider={index < sessions.length - 1}
              trailing={
                <>
                  <span className="dynamic-history-session-meta">{formatDateTime(session.startedAt)}</span>
                  {session.status === "monitoring" ? (
                    <button type="button" className="btn btn-danger btn-icon-sm" title="종료" onClick={(event) => { event.stopPropagation(); setConfirmStopId(session.id); }}>
                      <Activity size={14} />
                    </button>
                  ) : null}
                  {session.status === "stopped" ? (
                    <button type="button" className="btn btn-danger btn-icon-sm" title="삭제" onClick={(event) => { event.stopPropagation(); }}>
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </>
              }
            >
              <div className="page-section-stack">
                <div className="dynamic-history-session-meta">
                  <span className={cn("dynamic-history-session-badge", getSessionBadgeClass(session.status))}><Activity size={11} />{STATUS_LABELS[session.status] ?? session.status}</span>
                  <span className="dynamic-history-session-badge"><Plug size={11} />{session.source.adapterName ?? "어댑터"}</span>
                  <span className="inline-stack"><Radio size={12} /> {session.messageCount}건</span>
                  <span className="inline-stack"><AlertTriangle size={12} /> {session.alertCount}건</span>
                </div>
                {session.endedAt ? <div className="dynamic-history-session-ended">종료: {formatDateTime(session.endedAt)}</div> : null}
              </div>
            </ListItem>
          ))}
        </div>
      </div>
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
