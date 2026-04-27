import { useCallback, useEffect, useMemo, useState } from "react";
import type { Adapter, DynamicTestConfig, DynamicTestResult, TestStrategy } from "@aegis/shared";
import { ApiError, deleteDynamicTestResult, getDynamicTestResult, getDynamicTestResults, logError } from "../../../api/client";
import type { TestProgress } from "../../../hooks/useDynamicTest";
import type { ConnectionState } from "../../../utils/wsEnvelope";

type ToastAction = { label: string; onClick: () => void } | undefined;

type ToastApi = {
  error: (message: string, action?: ToastAction) => void;
};

type DynamicTestController = {
  view: string;
  progress: TestProgress;
  findings: unknown[];
  result: DynamicTestResult | null;
  error: string | null;
  connectionState: ConnectionState;
  startTest: (config: DynamicTestConfig, adapterId: string) => void;
  reset: () => void;
  viewResult: (result: DynamicTestResult) => void;
};

export function useDynamicTestPage(
  projectId: string | undefined,
  test: DynamicTestController,
  toast: ToastApi,
  connected: Adapter[],
  hasConnected: boolean,
) {
  const [history, setHistory] = useState<DynamicTestResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [adapterWarning, setAdapterWarning] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<DynamicTestResult | null>(null);
  const [testType, setTestType] = useState<"fuzzing" | "pentest">("fuzzing");
  const [strategy, setStrategy] = useState<TestStrategy>("random");
  const [targetEcu, setTargetEcu] = useState("ECU-01");
  const [targetId, setTargetId] = useState("0x100");
  const [count, setCount] = useState(50);
  const [selectedAdapterId, setSelectedAdapterId] = useState<string>("");

  useEffect(() => {
    document.title = "AEGIS — Dynamic Test";
  }, []);

  const loadHistory = useCallback(() => {
    if (!projectId) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    getDynamicTestResults(projectId)
      .then(setHistory)
      .catch((error) => {
        logError("Load test history", error);
        const retry = error instanceof ApiError && error.retryable ? { label: "다시 시도", onClick: loadHistory } : undefined;
        toast.error(error instanceof Error ? error.message : "테스트 이력을 불러올 수 없습니다.", retry);
      })
      .finally(() => setHistoryLoading(false));
  }, [projectId, toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (connected.length === 1 && !selectedAdapterId) {
      setSelectedAdapterId(connected[0].id);
    }
  }, [connected, selectedAdapterId]);

  const selectedAdapter = useMemo(
    () => connected.find((adapter) => adapter.id === selectedAdapterId),
    [connected, selectedAdapterId],
  );
  const ecuMeta = selectedAdapter?.ecuMeta?.[0];
  const hasEcuMeta = Boolean(ecuMeta);

  useEffect(() => {
    if (!selectedAdapterId || !ecuMeta) return;
    setTargetEcu(ecuMeta.name);
    setTargetId(ecuMeta.canIds[0] ?? "0x100");
  }, [ecuMeta, selectedAdapterId]);

  const handleStart = useCallback(() => {
    if (!selectedAdapterId) return;

    const config: DynamicTestConfig = {
      testType,
      strategy,
      targetEcu: targetEcu.trim(),
      protocol: "CAN",
      targetId: targetId.trim(),
      ...(strategy === "random" ? { count } : {}),
    };

    setShowConfig(false);
    test.startTest(config, selectedAdapterId);
  }, [count, selectedAdapterId, strategy, targetEcu, targetId, test, testType]);

  const handleDelete = useCallback(async (result: DynamicTestResult) => {
    try {
      await deleteDynamicTestResult(result.id);
      setHistory((prev) => prev.filter((item) => item.id !== result.id));
    } catch (error) {
      logError("Delete test result", error);
      toast.error("테스트 결과 삭제에 실패했습니다.");
    }
  }, [toast]);

  const handleViewResult = useCallback(async (result: DynamicTestResult) => {
    try {
      const detail = await getDynamicTestResult(result.id);
      test.viewResult(detail);
    } catch (error) {
      logError("Load test result", error);
      toast.error("테스트 결과를 불러올 수 없습니다.");
    }
  }, [test, toast]);

  const handleNewTest = useCallback(() => {
    test.reset();
    setShowConfig(false);
    loadHistory();
  }, [loadHistory, test]);

  const openConfig = useCallback(() => {
    if (!hasConnected) {
      setAdapterWarning(true);
      return;
    }

    setAdapterWarning(false);
    setShowConfig(true);
  }, [hasConnected]);

  return {
    history,
    historyLoading,
    showConfig,
    setShowConfig,
    adapterWarning,
    setAdapterWarning,
    confirmDeleteTarget,
    setConfirmDeleteTarget,
    testType,
    setTestType,
    strategy,
    setStrategy,
    targetEcu,
    setTargetEcu,
    targetId,
    setTargetId,
    count,
    setCount,
    selectedAdapterId,
    setSelectedAdapterId,
    ecuMeta,
    hasEcuMeta,
    handleStart,
    handleDelete,
    handleViewResult,
    handleNewTest,
    openConfig,
  };
}
