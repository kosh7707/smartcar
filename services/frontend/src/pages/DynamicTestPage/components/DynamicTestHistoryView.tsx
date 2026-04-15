import React from "react";
import type { Adapter, DynamicTestResult } from "@aegis/shared";
import { AlertTriangle, CheckCircle2, FlaskConical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ConnectionStatusBanner, ListItem, PageHeader, Spinner } from "../../../shared/ui";
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
        <Button onClick={() => {
          if (!hasConnected) { setAdapterWarning(true); return; }
          setAdapterWarning(false);
          onOpenConfig();
        }}>
          <Plus size={16} />
          새 세션
        </Button>
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
      <section className="dtest-history-empty">
        <div className="dtest-history-empty__copy">
          <p className="dtest-history-empty__eyebrow">Testing workspace</p>
          <h2 className="dtest-history-empty__title">아직 테스트 이력이 없습니다</h2>
          <p className="dtest-history-empty__description">
            퍼징·침투 테스트를 시작하면 대상 ECU, 전략, 결과 이력이 같은 작업면 안에서 이어지도록 정리됩니다.
          </p>
        </div>
        <div className="dtest-history-empty__readiness">
          <span><CheckCircle2 size={14} /> 어댑터 연결</span>
          <span><CheckCircle2 size={14} /> 전략 선택</span>
          <span><CheckCircle2 size={14} /> 결과 검토</span>
        </div>
        <div className="dtest-history-empty__actions">
          <Button onClick={() => {
            if (!hasConnected) { setAdapterWarning(true); return; }
            setAdapterWarning(false);
            onOpenConfig();
          }}>
            첫 세션 시작
          </Button>
        </div>
      </section>
    ) : (
      <div className="card">
        {history.map((result) => (
          <ListItem
            key={result.id}
            onClick={() => onOpenResult(result)}
            trailing={
              <>
                <span className="analysis-item__time">{formatDateTime(result.createdAt)}</span>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  className="analysis-item__delete"
                  title="삭제"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteTarget(result); }}
                >
                  <Trash2 size={14} />
                </Button>
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
