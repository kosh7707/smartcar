import React from "react";
import { useParams } from "react-router-dom";
import { useDynamicTest } from "../../hooks/useDynamicTest";
import { useToast } from "../../contexts/ToastContext";
import { useAdapters } from "../../hooks/useAdapters";
import { DynamicTestConfigView } from "./components/DynamicTestConfigView";
import { DynamicTestHistoryView } from "./components/DynamicTestHistoryView";
import { DynamicTestResultsView } from "./components/DynamicTestResultsView";
import { DynamicTestRunningView } from "./components/DynamicTestRunningView";
import { useDynamicTestPage } from "./hooks/useDynamicTestPage";
import "./DynamicTestPage.css";

export const DynamicTestPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connected, hasConnected } = useAdapters(projectId);
  const toast = useToast();
  const test = useDynamicTest(projectId);
  const {
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
  } = useDynamicTestPage(projectId, test, toast, connected, hasConnected);

  if (test.view === "running") {
    return (
      <DynamicTestRunningView progress={test.progress} findings={test.findings} />
    );
  }

  if (test.view === "results" && test.result) {
    return (
      <DynamicTestResultsView
        result={test.result}
        onBackToHistory={handleNewTest}
      />
    );
  }

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
      onOpenConfig={openConfig}
      onOpenResult={handleViewResult}
      onConfirmDelete={handleDelete}
    />
  );
};
