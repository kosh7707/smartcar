import React, { useCallback, useEffect } from "react";
import type { DynamicTestResult } from "@aegis/shared";
import { Plus, Trash2 } from "lucide-react";
import {
  ConfirmDialog,
  ConnectionStatusBanner,
  ListItem,
  PageHeader,
  Spinner,
} from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";
import type { ConnectionState } from "../../../utils/wsEnvelope";
import { STRATEGY_LABELS, TEST_TYPE_ICON } from "../dynamicTestPresentation";

const TEST_BOOT_LINES = [
  { status: "ok" as const, slot: "aegis-fuzzer",     value: "warm · rng/splice(mt19937)" },
  { status: "ok" as const, slot: "strategy-loader",  value: "fuzzing · penetration · replay" },
  { status: "ok" as const, slot: "payload-queue",    value: "000/000 pending" },
] as const;

interface DynamicTestBootConsoleProps {
  hasConnected: boolean;
  onStart: () => void;
}

const DynamicTestBootConsole: React.FC<DynamicTestBootConsoleProps> = ({ hasConnected, onStart }) => {
  const handleKey = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
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
    ? { slot: "target-ecu", value: "no ECU bound · bus idle" }
    : { slot: "adapter",    value: "no device on /dev/can0" };

  return (
    <section
      className="console-empty"
      tabIndex={0}
      role="group"
      aria-label="동적 테스트 워크벤치 — 첫 세션 시작 대기"
      onKeyDown={handleKey}
    >
      <div className="console-empty__scanlines" aria-hidden="true" />
      <div className="console-empty__scope">
        <div className="console-empty__bar" aria-hidden="true">
          <span className="console-empty__bar-dot console-empty__bar-dot--r" />
          <span className="console-empty__bar-dot console-empty__bar-dot--y" />
          <span className="console-empty__bar-dot console-empty__bar-dot--g" />
          <span className="console-empty__bar-label">aegis@fuzzer:~#</span>
          <span className="console-empty__bar-meta">dispatch --arm</span>
        </div>
        <div className="console-empty__log" aria-hidden="true">
          {TEST_BOOT_LINES.map((line, i) => (
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
            <span>to dispatch payload</span>
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
            <span>dispatch payload</span>
            <span className="console-empty__cta-hint">[ ↵ ]</span>
          </button>
        </div>
      </div>
    </section>
  );
};

interface DynamicTestHistoryViewProps {
  projectId?: string;
  connectionState: ConnectionState;
  hasConnected: boolean;
  adapterWarning: boolean;
  setAdapterWarning: (value: boolean) => void;
  historyLoading: boolean;
  history: DynamicTestResult[];
  confirmDeleteTarget: DynamicTestResult | null;
  setConfirmDeleteTarget: (target: DynamicTestResult | null) => void;
  onOpenConfig: () => void;
  onOpenResult: (result: DynamicTestResult) => void;
  onConfirmDelete: (result: DynamicTestResult) => void;
}

export const DynamicTestHistoryView: React.FC<DynamicTestHistoryViewProps> = ({
  projectId,
  connectionState,
  hasConnected,
  adapterWarning,
  setAdapterWarning,
  historyLoading,
  history,
  confirmDeleteTarget,
  setConfirmDeleteTarget,
  onOpenConfig,
  onOpenResult,
  onConfirmDelete,
}) => (
  <div className="page-shell dynamic-test-history-shell">
    <ConnectionStatusBanner connectionState={connectionState} />
    <PageHeader
      title="동적 테스트"
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
        >
          <Plus size={16} />새 세션
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
      <div className="dynamic-test-history__loading-shell">
        <Spinner label="이력 로딩 중..." />
      </div>
    ) : history.length === 0 ? (
      <DynamicTestBootConsole
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
      <div className="panel dynamic-test-history__list-card">
        <div className="panel-body dynamic-test-history__list-body">
          {history.map((result) => (
            <ListItem
              key={result.id}
              onClick={() => onOpenResult(result)}
              trailing={
                <>
                  <span className="dynamic-test-history__item-time">
                    {formatDateTime(result.createdAt)}
                  </span>
                  <button type="button"
                    className="btn btn-danger btn-icon-sm dynamic-test-history__delete-button"
                    title="삭제"
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmDeleteTarget(result);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              }
            >
              <div className="dynamic-test-history__item-copy">
                <div className="dynamic-test-history__item-head">
                  <span className="dynamic-test-history__type-badge">
                    {TEST_TYPE_ICON[result.config.testType]}
                    {result.config.testType === "fuzzing" ? "퍼징" : "침투"}
                  </span>
                  <span className="dynamic-test-history__item-strategy">
                    {STRATEGY_LABELS[result.config.strategy]}
                  </span>
                  <span className="dynamic-test-history__item-count">
                    {result.totalRuns}회
                  </span>
                  {result.crashes > 0 ? (
                    <span className="dynamic-test-history__item-metric dynamic-test-history__item-metric--crash">
                      Crash {result.crashes}
                    </span>
                  ) : null}
                  {result.anomalies > 0 ? (
                    <span className="dynamic-test-history__item-metric dynamic-test-history__item-metric--anomaly">
                      Anomaly {result.anomalies}
                    </span>
                  ) : null}
                </div>
                <div className="dynamic-test-history__item-target">
                  {result.config.targetEcu} · {result.config.protocol} · {result.config.targetId}
                </div>
              </div>
            </ListItem>
          ))}
        </div>
      </div>
    )}

    <ConfirmDialog
      open={confirmDeleteTarget !== null}
      title="테스트 결과 삭제"
      message="이 테스트 결과를 삭제하시겠습니까?"
      confirmLabel="삭제"
      danger
      onConfirm={() => {
        if (confirmDeleteTarget) onConfirmDelete(confirmDeleteTarget);
        setConfirmDeleteTarget(null);
      }}
      onCancel={() => setConfirmDeleteTarget(null)}
    />
  </div>
);
