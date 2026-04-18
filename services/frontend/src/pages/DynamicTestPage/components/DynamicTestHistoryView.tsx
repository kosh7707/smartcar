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
  <div className="page-enter space-y-5">
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

    {adapterWarning && (
      <Alert variant="destructive">
        <AlertTriangle size={16} />
        <AlertTitle>연결된 어댑터가 없습니다</AlertTitle>
        <AlertDescription>
          <a className="underline underline-offset-4" href={`#/projects/${projectId}/settings`}>
            프로젝트 설정
          </a>
          에서 어댑터를 연결해주세요.
        </AlertDescription>
      </Alert>
    )}

    {historyLoading ? (
      <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
        <Spinner label="이력 로딩 중..." />
      </div>
    ) : history.length === 0 ? (
      <Card className="shadow-none">
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Testing workspace
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              아직 테스트 이력이 없습니다
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              퍼징·침투 테스트를 시작하면 대상 ECU, 전략, 결과 이력이 같은
              작업면 안에서 이어지도록 정리됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "어댑터 연결",
              "전략 선택",
              "결과 검토",
            ].map((step) => (
              <Badge
                key={step}
                variant="outline"
                className="h-auto rounded-full px-3 py-1 text-sm"
              >
                <CheckCircle2 size={14} />
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
      <Card className="shadow-none">
        <CardContent className="space-y-2 p-3">
          {history.map((result) => (
            <ListItem
              key={result.id}
              onClick={() => onOpenResult(result)}
              trailing={
                <>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(result.createdAt)}
                  </span>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover/list-item:opacity-100"
                    title="삭제"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteTarget(result);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </>
              }
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge
                    variant="outline"
                    className="h-auto rounded-full border-primary/30 bg-primary/10 px-2.5 py-1 text-sm text-primary"
                  >
                    {TEST_TYPE_ICON[result.config.testType]}
                    {result.config.testType === "fuzzing" ? "퍼징" : "침투"}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {STRATEGY_LABELS[result.config.strategy]}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {result.totalRuns}회
                  </span>
                  {result.crashes > 0 && (
                    <span className="text-sm font-medium text-destructive">
                      Crash {result.crashes}
                    </span>
                  )}
                  {result.anomalies > 0 && (
                    <span className="text-sm font-medium text-[var(--aegis-severity-medium)]">
                      Anomaly {result.anomalies}
                    </span>
                  )}
                </div>
                <div className="pl-1 text-sm text-muted-foreground">
                  {result.config.targetEcu} · {result.config.protocol} ·{" "}
                  {result.config.targetId}
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
