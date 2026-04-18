import React, { useState } from "react";
import type { AnalysisResult } from "@aegis/shared";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Cpu,
  Package,
  Tag,
  Target,
} from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { highlightCVEs } from "../../../utils/cveHighlight";

const TERMINATION_LABELS: Record<string, string> = {
  content_returned: "정상 완료",
  max_steps: "최대 스텝 도달",
  budget_exhausted: "토큰 예산 소진",
  timeout: "시간 초과",
  no_new_evidence: "추가 증거 없음",
  all_tiers_exhausted: "모든 도구 소진",
  error: "오류",
};

function formatTerminationReason(reason: string): string {
  if (reason.startsWith("llm_failure_partial:")) {
    const code = reason.split(":").slice(1).join(":");
    return `LLM 부분 실패 (${code})`;
  }
  return TERMINATION_LABELS[reason] ?? reason;
}

interface Props {
  analysisResult: AnalysisResult;
}

const BREAKDOWN_LABELS: { key: string; label: string }[] = [
  { key: "grounding", label: "증적 근거" },
  { key: "deterministicSupport", label: "결정론적 뒷받침" },
  { key: "ragCoverage", label: "KB 커버리지" },
  { key: "schemaCompliance", label: "스키마 준수" },
];

export const AgentResultPanel: React.FC<Props> = ({ analysisResult }) => {
  const [auditOpen, setAuditOpen] = useState(false);

  const {
    confidenceScore,
    confidenceBreakdown,
    needsHumanReview,
    caveats,
    recommendedNextSteps,
    policyFlags,
    scaLibraries,
    agentAudit,
  } = analysisResult;

  const hasAgentData =
    confidenceScore != null ||
    caveats?.length ||
    recommendedNextSteps?.length ||
    policyFlags?.length ||
    scaLibraries?.length ||
    agentAudit;

  if (!hasAgentData) return null;

  return (
    <div className="flex flex-col gap-5">
      {confidenceScore != null && (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <Target size={16} /> 분석 신뢰도
            </CardTitle>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
                  {(confidenceScore * 100).toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground">신뢰도</span>
                {needsHumanReview && (
                  <span className="mt-1 inline-flex min-h-6 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--aegis-severity-high)_12%,transparent)] px-2 text-sm font-semibold text-[var(--aegis-severity-high)]">
                    <AlertTriangle size={11} /> 검토 필요
                  </span>
                )}
              </div>
              {confidenceBreakdown && (
                <div className="min-w-0 flex-1 space-y-3">
                  {BREAKDOWN_LABELS.map(({ key, label }) => {
                    const value = (confidenceBreakdown as Record<string, number>)[key] ?? 0;
                    return (
                      <div key={key} className="flex items-center gap-4">
                        <span className="w-[140px] shrink-0 text-right text-sm text-muted-foreground max-sm:w-[100px]">
                          {label}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/70">
                          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${value * 100}%` }} />
                        </div>
                        <span className="w-9 text-right text-sm font-semibold text-foreground tabular-nums">
                          {(value * 100).toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {caveats && caveats.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={16} /> 분석 한계 ({caveats.length})
            </CardTitle>
            <ul className="list-disc space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
              {caveats.map((c, i) => (
                <li key={i}>{highlightCVEs(c)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {recommendedNextSteps && recommendedNextSteps.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList size={16} /> 수정 권고 ({recommendedNextSteps.length})
            </CardTitle>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
              {recommendedNextSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {policyFlags && policyFlags.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <Tag size={16} /> 정책 플래그
            </CardTitle>
            <div className="flex flex-wrap gap-3">
              {policyFlags.map((flag) => {
                const isCve = flag.startsWith("CVE-");
                const isCwe = flag.startsWith("CWE-");
                return (
                  <span
                    key={flag}
                    className={[
                      "inline-flex min-h-6 items-center rounded-full border px-2 text-sm font-medium",
                      isCve
                        ? "border-[var(--aegis-severity-high)] bg-[color-mix(in_srgb,var(--aegis-severity-high)_8%,transparent)] text-[var(--aegis-severity-high)]"
                        : isCwe
                          ? "border-[var(--aegis-severity-medium)] bg-[color-mix(in_srgb,var(--aegis-severity-medium)_8%,transparent)] text-[var(--aegis-severity-medium)]"
                          : "border-border bg-background/90 text-muted-foreground",
                    ].join(" ")}
                  >
                    {flag}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {scaLibraries && scaLibraries.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <Package size={16} /> 서드파티 라이브러리 ({scaLibraries.length})
            </CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-muted-foreground">이름</th>
                    <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-muted-foreground">버전</th>
                    <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-muted-foreground">경로</th>
                  </tr>
                </thead>
                <tbody>
                  {scaLibraries.map((lib) => (
                    <tr key={`${lib.name}-${lib.path}`}>
                      <td className="border-b border-border px-4 py-3 font-medium text-foreground">
                        {lib.repoUrl ? (
                          <a href={lib.repoUrl} target="_blank" rel="noopener noreferrer" className="text-primary no-underline hover:underline">
                            {lib.name}
                          </a>
                        ) : (
                          lib.name
                        )}
                      </td>
                      <td className="border-b border-border px-4 py-3 font-mono text-sm text-muted-foreground">
                        {lib.version ?? "—"}
                      </td>
                      <td className="border-b border-border px-4 py-3 font-mono text-sm text-muted-foreground">
                        {lib.path}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {agentAudit && (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <button
              className="flex items-center gap-3 bg-transparent py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              aria-expanded={auditOpen}
              onClick={() => setAuditOpen(!auditOpen)}
            >
              <ChevronRight size={14} style={{ transform: auditOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
              <Cpu size={16} />
              에이전트 실행 정보
            </button>
            {auditOpen && (
              <div className="mt-3 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">소요 시간</span>
                  <span className="font-mono text-sm font-medium text-foreground tabular-nums">{(agentAudit.latencyMs / 1000).toFixed(1)}초</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">프롬프트 토큰</span>
                  <span className="font-mono text-sm font-medium text-foreground tabular-nums">{agentAudit.tokenUsage.prompt.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">응답 토큰</span>
                  <span className="font-mono text-sm font-medium text-foreground tabular-nums">{agentAudit.tokenUsage.completion.toLocaleString()}</span>
                </div>
                {agentAudit.turnCount != null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-muted-foreground">턴 수</span>
                    <span className="font-mono text-sm font-medium text-foreground tabular-nums">{agentAudit.turnCount}</span>
                  </div>
                )}
                {agentAudit.toolCallCount != null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-muted-foreground">도구 호출</span>
                    <span className="font-mono text-sm font-medium text-foreground tabular-nums">{agentAudit.toolCallCount}회</span>
                  </div>
                )}
                {agentAudit.terminationReason && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-muted-foreground">종료 사유</span>
                    <span className="font-mono text-sm font-medium text-foreground tabular-nums">{formatTerminationReason(agentAudit.terminationReason)}</span>
                  </div>
                )}
                {agentAudit.modelName && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-muted-foreground">LLM 모델</span>
                    <span className="font-mono text-sm font-medium text-foreground tabular-nums">{agentAudit.modelName}</span>
                  </div>
                )}
                {agentAudit.promptVersion && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-muted-foreground">프롬프트 버전</span>
                    <span className="font-mono text-sm font-medium text-foreground tabular-nums">{agentAudit.promptVersion}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
