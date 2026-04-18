import React, { useState } from "react";
import type { DynamicTestResult } from "@aegis/shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  BackButton,
  EmptyState,
  PageHeader,
  SeverityBadge,
  StatCard,
} from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";
import {
  FINDING_TYPE_ICON,
  FINDING_TYPE_LABEL,
  STRATEGY_LABELS,
} from "../dynamicTestPresentation";

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
    <div className="page-enter space-y-5">
      <BackButton onClick={onBackToHistory} label="세션 목록으로" />
      <PageHeader title="테스트 결과" />

      <div className="stagger mb-5 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <StatCard label="총 실행" value={result.totalRuns} accent />
        <StatCard
          label="Crashes"
          value={result.crashes}
          color="var(--cds-support-error)"
        />
        <StatCard
          label="Anomalies"
          value={result.anomalies}
          color="var(--aegis-severity-medium)"
        />
        <StatCard label="Findings" value={result.findings.length} accent />
      </div>

      <Card className="shadow-none">
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="font-medium text-muted-foreground">유형</div>
            <div className="text-foreground">
              {result.config.testType === "fuzzing" ? "퍼징" : "침투 테스트"}
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="font-medium text-muted-foreground">전략</div>
            <div className="text-foreground">{STRATEGY_LABELS[result.config.strategy]}</div>
          </div>
          <div className="space-y-1 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="font-medium text-muted-foreground">대상</div>
            <div className="text-foreground">
              {result.config.targetEcu} · {result.config.protocol} · {result.config.targetId}
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="font-medium text-muted-foreground">실행일시</div>
            <div className="text-foreground">{formatDateTime(result.createdAt)}</div>
          </div>
        </CardContent>
      </Card>

      {result.findings.length > 0 ? (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <CardTitle>Findings ({result.findings.length})</CardTitle>
            <div className="space-y-3">
              {result.findings.map((finding) => {
                const expanded = expandedId === finding.id;
                return (
                  <Card key={finding.id} className="border-border/70 shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 text-left"
                        onClick={() =>
                          setExpandedId(expanded ? null : finding.id)
                        }
                      >
                        <SeverityBadge severity={finding.severity} size="sm" />
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          {FINDING_TYPE_ICON[finding.type]}
                          {FINDING_TYPE_LABEL[finding.type]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {finding.description}
                        </span>
                        {finding.llmAnalysis ? (
                          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : null}
                      </button>
                      <div className="space-y-2 pl-1 text-sm">
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="min-w-14 font-medium text-muted-foreground">Input</span>
                          <code className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-primary break-all">
                            {finding.input}
                          </code>
                        </div>
                        {finding.response && (
                          <div className="flex flex-wrap items-start gap-2">
                            <span className="min-w-14 font-medium text-muted-foreground">Response</span>
                            <code className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-primary break-all">
                              {finding.response}
                            </code>
                          </div>
                        )}
                      </div>
                      {finding.llmAnalysis && expanded && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                          <div className="mb-1 font-medium text-primary">LLM 분석</div>
                          <p className="leading-6">{finding.llmAnalysis}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="발견된 이상이 없습니다" />
      )}
    </div>
  );
};
