import React, { useState } from "react";
import type { DynamicTestResult } from "@aegis/shared";
import { BackButton, EmptyState, PageHeader, SeverityBadge, StatCard } from "../../../shared/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDateTime } from "../../../utils/format";
import { FINDING_TYPE_ICON, FINDING_TYPE_LABEL, STRATEGY_LABELS } from "../dynamicTestPresentation";

interface DynamicTestResultsViewProps {
  result: DynamicTestResult;
  onBackToHistory: () => void;
}

export const DynamicTestResultsView: React.FC<DynamicTestResultsViewProps> = ({ result, onBackToHistory }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="page-enter">
      <BackButton onClick={onBackToHistory} label="세션 목록으로" />
      <PageHeader title="테스트 결과" />

      <div className="stat-cards stagger">
        <StatCard label="총 실행" value={result.totalRuns} accent />
        <StatCard label="Crashes" value={result.crashes} color="var(--cds-support-error)" />
        <StatCard label="Anomalies" value={result.anomalies} color="var(--aegis-severity-medium)" />
        <StatCard label="Findings" value={result.findings.length} accent />
      </div>

      <div className="card dtest-result-config">
        <div className="dtest-result-config__row">
          <span className="dtest-result-config__label">유형</span>
          <span>{result.config.testType === "fuzzing" ? "퍼징" : "침투 테스트"}</span>
        </div>
        <div className="dtest-result-config__row">
          <span className="dtest-result-config__label">전략</span>
          <span>{STRATEGY_LABELS[result.config.strategy]}</span>
        </div>
        <div className="dtest-result-config__row">
          <span className="dtest-result-config__label">대상</span>
          <span>{result.config.targetEcu} · {result.config.protocol} · {result.config.targetId}</span>
        </div>
        <div className="dtest-result-config__row">
          <span className="dtest-result-config__label">실행일시</span>
          <span>{formatDateTime(result.createdAt)}</span>
        </div>
      </div>

      {result.findings.length > 0 ? (
        <div className="card">
          <div className="card-title">Findings ({result.findings.length})</div>
          {result.findings.map((finding) => (
            <div key={finding.id} className="dtest-finding-card" onClick={() => setExpandedId(expandedId === finding.id ? null : finding.id)}>
              <div className="dtest-finding-card__header">
                <SeverityBadge severity={finding.severity} size="sm" />
                <span className="dtest-finding-card__type">
                  {FINDING_TYPE_ICON[finding.type]}
                  {FINDING_TYPE_LABEL[finding.type]}
                </span>
                <span className="dtest-finding-card__desc">{finding.description}</span>
                {finding.llmAnalysis && (
                  expandedId === finding.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                )}
              </div>
              <div className="dtest-finding-card__io">
                <div className="dtest-finding-card__io-row">
                  <span className="dtest-finding-card__io-label">Input</span>
                  <code>{finding.input}</code>
                </div>
                {finding.response && (
                  <div className="dtest-finding-card__io-row">
                    <span className="dtest-finding-card__io-label">Response</span>
                    <code>{finding.response}</code>
                  </div>
                )}
              </div>
              {finding.llmAnalysis && expandedId === finding.id && (
                <div className="dtest-finding-card__llm animate-fade-in">
                  <span className="dtest-finding-card__llm-title">LLM 분석</span>
                  <p>{finding.llmAnalysis}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="발견된 이상이 없습니다"
        />
      )}
    </div>
  );
};
