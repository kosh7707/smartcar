import React from "react";
import type { DynamicTestResult } from "@aegis/shared";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ConfirmDialog,
  ConnectionStatusBanner,
  ListItem,
  PageHeader,
  Spinner,
} from "../../../shared/ui";
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
  <div className="page-shell dynamic-test-history-shell">
    <ConnectionStatusBanner connectionState={connectionState as any} />
    <PageHeader
      title="동적 테스트"
      action={
        <Button
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
        </Button>
      }
    />

    {adapterWarning ? (
      <Alert variant="destructive">
        <AlertTriangle size={16} />
        <AlertTitle>연결된 어댑터가 없습니다</AlertTitle>
        <AlertDescription>
          <a className="dynamic-test-history__settings-link" href={`#/projects/${projectId}/settings`}>
            프로젝트 설정
          </a>
          에서 어댑터를 연결해주세요.
        </AlertDescription>
      </Alert>
    ) : null}

    {historyLoading ? (
      <div className="dynamic-test-history__loading-shell">
        <Spinner label="이력 로딩 중..." />
      </div>
    ) : history.length === 0 ? (
      <Card className="dynamic-test-history__empty-card">
        <CardContent className="dynamic-test-history__empty-body">
          <div className="dynamic-test-history__empty-copy">
            <p className="dynamic-test-history__empty-eyebrow">Testing workspace</p>
            <h2 className="dynamic-test-history__empty-title">아직 테스트 이력이 없습니다</h2>
            <p className="dynamic-test-history__empty-description">
              퍼징·침투 테스트를 시작하면 대상 ECU, 전략, 결과 이력이 같은
              작업면 안에서 이어지도록 정리됩니다.
            </p>
          </div>
          <div className="dynamic-test-history__empty-checks">
            {["어댑터 연결", "전략 선택", "결과 검토"].map((step) => (
              <Badge key={step} variant="outline" className="dynamic-test-history__empty-check">
                <CheckCircle2 size={14} className="dynamic-test-history__empty-check-icon" />
                {step}
              </Badge>
            ))}
          </div>
          <div>
            <Button
              onClick={() => {
                if (!hasConnected) {
                  setAdapterWarning(true);
                  return;
                }
                setAdapterWarning(false);
                onOpenConfig();
              }}
            >
              첫 세션 시작
            </Button>
          </div>
        </CardContent>
      </Card>
    ) : (
      <Card className="dynamic-test-history__list-card">
        <CardContent className="dynamic-test-history__list-body">
          {history.map((result) => (
            <ListItem
              key={result.id}
              onClick={() => onOpenResult(result)}
              trailing={
                <>
                  <span className="dynamic-test-history__item-time">
                    {formatDateTime(result.createdAt)}
                  </span>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    className="dynamic-test-history__delete-button"
                    title="삭제"
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmDeleteTarget(result);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </>
              }
            >
              <div className="dynamic-test-history__item-copy">
                <div className="dynamic-test-history__item-head">
                  <Badge variant="outline" className="dynamic-test-history__type-badge">
                    {TEST_TYPE_ICON[result.config.testType]}
                    {result.config.testType === "fuzzing" ? "퍼징" : "침투"}
                  </Badge>
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
        </CardContent>
      </Card>
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
