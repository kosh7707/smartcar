import React, { useEffect, useState, useRef } from "react";
import "../../shared/analysis/AnalysisListItem.css";
import { useParams } from "react-router-dom";
import type { DynamicTestConfig, DynamicTestResult, DynamicTestFinding, TestStrategy } from "@aegis/shared";
import { AlertTriangle, Bug, Clock, FlaskConical, Plus, Play, Trash2, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { getDynamicTestResults, getDynamicTestResult, deleteDynamicTestResult, ApiError, logError } from "../../api/client";
import { useDynamicTest, type TestProgress } from "../../hooks/useDynamicTest";
import { useToast } from "../../contexts/ToastContext";
import { useAdapters } from "../../hooks/useAdapters";
import { PageHeader, EmptyState, ConfirmDialog, ListItem, SeverityBadge, StatCard, Spinner, BackButton, AdapterSelector, ConnectionStatusBanner } from "../../shared/ui";
import { formatDateTime } from "../../utils/format";
import { DynamicTestConfigView } from "./components/DynamicTestConfigView";
import { DynamicTestHistoryView } from "./components/DynamicTestHistoryView";
import { DynamicTestResultsView } from "./components/DynamicTestResultsView";
import { DynamicTestRunningView } from "./components/DynamicTestRunningView";
import { FINDING_TYPE_ICON, FINDING_TYPE_LABEL, STRATEGY_LABELS } from "./dynamicTestPresentation";
import "./DynamicTestPage.css";

export const DynamicTestPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connected, hasConnected } = useAdapters(projectId);
  const toast = useToast();
  const test = useDynamicTest(projectId);

  useEffect(() => {
    document.title = "AEGIS — Dynamic Test";
  }, []);

  const [history, setHistory] = useState<DynamicTestResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [adapterWarning, setAdapterWarning] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<DynamicTestResult | null>(null);

  // Config form state
  const [testType, setTestType] = useState<"fuzzing" | "pentest">("fuzzing");
  const [strategy, setStrategy] = useState<TestStrategy>("random");
  const [targetEcu, setTargetEcu] = useState("ECU-01");
  const [targetId, setTargetId] = useState("0x100");
  const [count, setCount] = useState(50);
  const [selectedAdapterId, setSelectedAdapterId] = useState<string>("");

  const loadHistory = () => {
    if (!projectId) return;
    getDynamicTestResults(projectId)
      .then(setHistory)
      .catch((e) => {
        logError("Load test history", e);
        const retry = e instanceof ApiError && e.retryable ? { label: "다시 시도", onClick: loadHistory } : undefined;
        toast.error(e instanceof Error ? e.message : "테스트 이력을 불러올 수 없습니다.", retry);
      })
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  // Auto-select adapter if only one connected
  useEffect(() => {
    if (connected.length === 1 && !selectedAdapterId) {
      setSelectedAdapterId(connected[0].id);
    }
  }, [connected, selectedAdapterId]);

  // Auto-populate from ecuMeta when adapter is selected
  const selectedAdapter = connected.find((a) => a.id === selectedAdapterId);
  const ecuMeta = selectedAdapter?.ecuMeta?.[0];
  const hasEcuMeta = !!ecuMeta;

  useEffect(() => {
    if (!selectedAdapterId) return;
    if (ecuMeta) {
      setTargetEcu(ecuMeta.name);
      setTargetId(ecuMeta.canIds[0] ?? "0x100");
    }
  }, [selectedAdapterId]);

  const handleStart = () => {
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
  };

  const handleDelete = async (r: DynamicTestResult) => {
    try {
      await deleteDynamicTestResult(r.id);
      setHistory((prev) => prev.filter((h) => h.id !== r.id));
    } catch (e) {
      logError("Delete test result", e);
      toast.error("테스트 결과 삭제에 실패했습니다.");
    }
  };

  const handleViewResult = async (r: DynamicTestResult) => {
    try {
      const detail = await getDynamicTestResult(r.id);
      test.viewResult(detail);
    } catch (e) {
      logError("Load test result", e);
      toast.error("테스트 결과를 불러올 수 없습니다.");
    }
  };

  const handleNewTest = () => {
    test.reset();
    setShowConfig(false);
    loadHistory();
  };

  // ── Running view ──
  if (test.view === "running") {
    return <DynamicTestRunningView progress={test.progress} findings={test.findings} />;
  }

  // ── Results view ──
  if (test.view === "results" && test.result) {
    return (
      <DynamicTestResultsView result={test.result} onBackToHistory={handleNewTest} />
    );
  }

  // ── Config view (new test form) ──
  if (showConfig) {
    return (
      <DynamicTestConfigView
        connected={connected}
        selectedAdapterId={selectedAdapterId}
        setSelectedAdapterId={setSelectedAdapterId}
        testType={testType}
        setTestType={setTestType}
        strategy={strategy}
        setStrategy={setStrategy}
        targetEcu={targetEcu}
        setTargetEcu={setTargetEcu}
        targetId={targetId}
        setTargetId={setTargetId}
        count={count}
        setCount={setCount}
        hasEcuMeta={hasEcuMeta}
        ecuMeta={ecuMeta}
        error={test.error}
        onBack={() => setShowConfig(false)}
        onStart={handleStart}
      />
    );
  }

  // ── Default: history list ──
  return (
    <DynamicTestHistoryView
      projectId={projectId}
      connectionState={test.connectionState}
      hasConnected={hasConnected}
      adapterWarning={adapterWarning}
      setAdapterWarning={setAdapterWarning}
      historyLoading={historyLoading}
      history={history}
      confirmDeleteTarget={confirmDeleteTarget}
      setConfirmDeleteTarget={setConfirmDeleteTarget}
      onOpenConfig={() => setShowConfig(true)}
      onOpenResult={handleViewResult}
      onConfirmDelete={handleDelete}
    />
  );
};
