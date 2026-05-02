import "./DynamicTestResultsView.css";
import React, { useState } from "react";
import type { DynamicTestResult } from "@aegis/shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  BackButton,
  EmptyState,
  PageHeader,
  SeverityBadge,
  StatCard,
} from "@/common/ui/primitives";
import { formatDateTime } from "@/common/utils/format";
import {
  FINDING_TYPE_ICON,
  FINDING_TYPE_LABEL,
  STRATEGY_LABELS,
} from "../../dynamicTestPresentation";

interface DynamicTestResultsViewProps {
  result: DynamicTestResult;
  onBackToHistory: () => void;
}

export const DynamicTestResultsView: React.FC<DynamicTestResultsViewProps> = ({
  result,
  onBackToHistory,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="page-shell dynamic-test-results-shell">
      <BackButton onClick={onBackToHistory} label="세션 목록으로" />
      <PageHeader title="테스트 결과" />

      <div className="dynamic-test-results-stats">
        <StatCard label="총 실행" value={result.totalRuns} accent />
        <StatCard label="Crashes" value={result.crashes} color="var(--danger)" />
        <StatCard label="Anomalies" value={result.anomalies} color="var(--severity-medium)" />
        <StatCard label="Findings" value={result.findings.length} accent />
      </div>

      <div className="panel dynamic-test-results-meta-card">
        <div className="panel-body dynamic-test-results-meta-grid">
          <div className="dynamic-test-results-meta-item">
            <div className="dynamic-test-results-meta-label">유형</div>
            <div className="dynamic-test-results-meta-value">
              {result.config.testType === "fuzzing" ? "퍼징" : "침투 테스트"}
            </div>
          </div>
          <div className="dynamic-test-results-meta-item">
            <div className="dynamic-test-results-meta-label">전략</div>
            <div className="dynamic-test-results-meta-value">{STRATEGY_LABELS[result.config.strategy]}</div>
          </div>
          <div className="dynamic-test-results-meta-item">
            <div className="dynamic-test-results-meta-label">대상</div>
            <div className="dynamic-test-results-meta-value">
              {result.config.targetEcu} · {result.config.protocol} · {result.config.targetId}
            </div>
          </div>
          <div className="dynamic-test-results-meta-item">
            <div className="dynamic-test-results-meta-label">실행일시</div>
            <div className="dynamic-test-results-meta-value">{formatDateTime(result.createdAt)}</div>
          </div>
        </div>
      </div>

      {result.findings.length > 0 ? (
        <div className="panel dynamic-test-results-findings-card">
          <div className="panel-body dynamic-test-results-findings-body">
            <h3 className="panel-title">Findings ({result.findings.length})</h3>
            <div className="dynamic-test-results-findings-list">
              {result.findings.map((finding) => {
                const expanded = expandedId === finding.id;
                return (
                  <div className="panel dynamic-test-results-finding-card" key={finding.id}>
                    <div className="panel-body dynamic-test-results-finding-body">
                      <button
                        type="button"
                        className="dynamic-test-results-finding-toggle"
                        onClick={() => setExpandedId(expanded ? null : finding.id)}
                      >
                        <SeverityBadge severity={finding.severity} />
                        <span className="dynamic-test-results-finding-type">
                          {FINDING_TYPE_ICON[finding.type]}
                          {FINDING_TYPE_LABEL[finding.type]}
                        </span>
                        <span className="dynamic-test-results-finding-description">
                          {finding.description}
                        </span>
                        {finding.llmAnalysis ? (
                          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : null}
                      </button>
                      <div className="dynamic-test-results-finding-io-list">
                        <div className="dynamic-test-results-finding-io-row">
                          <span className="dynamic-test-results-finding-io-label">Input</span>
                          <code className="dynamic-test-results-finding-code">{finding.input}</code>
                        </div>
                        {finding.response ? (
                          <div className="dynamic-test-results-finding-io-row">
                            <span className="dynamic-test-results-finding-io-label">Response</span>
                            <code className="dynamic-test-results-finding-code">{finding.response}</code>
                          </div>
                        ) : null}
                      </div>
                      {finding.llmAnalysis && expanded ? (
                        <div className="dynamic-test-results-finding-llm">
                          <div className="dynamic-test-results-finding-llm-title">LLM 분석</div>
                          <p className="dynamic-test-results-finding-llm-copy">{finding.llmAnalysis}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState title="발견된 이상이 없습니다" />
      )}
    </div>
  );
};
