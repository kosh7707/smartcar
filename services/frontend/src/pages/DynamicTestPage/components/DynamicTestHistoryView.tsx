import React from "react";
import type { Adapter, DynamicTestResult } from "@aegis/shared";
import { AlertTriangle, FlaskConical, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog, ConnectionStatusBanner, EmptyState, ListItem, PageHeader, Spinner } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";
import { STRATEGY_LABELS, TEST_TYPE_ICON } from "../dynamicTestPresentation";

interface DynamicTestHistoryViewProps {
  projectId?: string;
  connectionState: string;
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
  <div className="page-enter">
    <ConnectionStatusBanner connectionState={connectionState as any} />
    <PageHeader
      title="동적 테스트"
      action={
        <button className="btn" onClick={() => {
          if (!hasConnected) { setAdapterWarning(true); return; }
          setAdapterWarning(false);
          onOpenConfig();
        }}>
          <Plus size={16} />
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

    {historyLoading ? (
      <div className="centered-loader--compact">
        <Spinner label="이력 로딩 중..." />
      </div>
    ) : history.length === 0 ? (
      <EmptyState
        title="아직 테스트 이력이 없습니다"
        description="ECU에 퍼징/침투 테스트를 실행하고 취약점을 탐지합니다"
        action={
          <button className="btn" onClick={() => {
            if (!hasConnected) { setAdapterWarning(true); return; }
            setAdapterWarning(false);
            onOpenConfig();
          }}>
            첫 세션 시작
          </button>
        }
      />
    ) : (
      <div className="card">
        {history.map((result) => (
          <ListItem
            key={result.id}
            onClick={() => onOpenResult(result)}
            trailing={
              <>
                <span className="analysis-item__time">{formatDateTime(result.createdAt)}</span>
                <button
                  className="btn-icon btn-danger analysis-item__delete"
                  title="삭제"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteTarget(result); }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            }
          >
            <div>
              <div className="analysis-item__header">
                <span className="analysis-item__badge analysis-item__badge--test">
                  {TEST_TYPE_ICON[result.config.testType]}
                  {result.config.testType === "fuzzing" ? "퍼징" : "침투"}
                </span>
                <span className="analysis-item__label">{STRATEGY_LABELS[result.config.strategy]}</span>
                <span className="analysis-item__stat">{result.totalRuns}회</span>
                {result.crashes > 0 && <span className="analysis-item__stat analysis-item__stat--cds-support-error">Crash {result.crashes}</span>}
                {result.anomalies > 0 && <span className="analysis-item__stat analysis-item__stat--warn">Anomaly {result.anomalies}</span>}
              </div>
              <div className="analysis-item__sub">
                {result.config.targetEcu} · {result.config.protocol} · {result.config.targetId}
              </div>
            </div>
          </ListItem>
        ))}
      </div>
    )}

    <ConfirmDialog
      open={confirmDeleteTarget !== null}
      title="테스트 결과 삭제"
      message="이 테스트 결과를 삭제하시겠습니까?"
      confirmLabel="삭제"
      danger
      onConfirm={() => { if (confirmDeleteTarget) onConfirmDelete(confirmDeleteTarget); setConfirmDeleteTarget(null); }}
      onCancel={() => setConfirmDeleteTarget(null)}
    />
  </div>
);
