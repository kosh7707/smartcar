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
import { cn } from "@/lib/utils";
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

const PROVENANCE_FLAGS: Record<string, string> = {
  structured_finalizer: "구조화 마감",
};

function getPolicyFlagClass(flag: string): string {
  if (flag.startsWith("CVE-")) return "agent-result-flag agent-result-flag--cve";
  if (flag.startsWith("CWE-")) return "agent-result-flag agent-result-flag--cwe";
  if (flag in PROVENANCE_FLAGS) return "agent-result-flag agent-result-flag--provenance";
  return "agent-result-flag";
}

function formatPolicyFlag(flag: string): string {
  return PROVENANCE_FLAGS[flag] ?? flag;
}

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
    <div className="agent-result-panel">
      {confidenceScore != null && (
        <Card className="agent-result-card">
          <CardContent className="agent-result-card-body">
            <CardTitle className="agent-result-title">
              <Target size={16} /> 분석 신뢰도
            </CardTitle>
            <div className="agent-result-score-layout">
              <div className="agent-result-score-main">
                <span className="agent-result-score-value">
                  {(confidenceScore * 100).toFixed(1)}%
                </span>
                <span className="agent-result-score-label">신뢰도</span>
                {needsHumanReview && (
                  <span className="agent-result-review-badge">
                    <AlertTriangle size={11} /> 검토 필요
                  </span>
                )}
              </div>
              {confidenceBreakdown && (
                <div className="agent-result-breakdown">
                  {BREAKDOWN_LABELS.map(({ key, label }) => {
                    const value = (confidenceBreakdown as Record<string, number>)[key] ?? 0;
                    return (
                      <div key={key} className="agent-result-breakdown-row">
                        <span className="agent-result-breakdown-label">{label}</span>
                        <div className="agent-result-breakdown-bar">
                          <div
                            className="agent-result-breakdown-fill"
                            style={{ width: `${value * 100}%` }}
                          />
                        </div>
                        <span className="agent-result-breakdown-value">
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
        <Card className="agent-result-card">
          <CardContent className="agent-result-card-body">
            <CardTitle className="agent-result-title">
              <AlertTriangle size={16} /> 분석 한계 ({caveats.length})
            </CardTitle>
            <ul className="agent-result-list agent-result-list--bulleted">
              {caveats.map((c, i) => (
                <li key={i}>{highlightCVEs(c)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {recommendedNextSteps && recommendedNextSteps.length > 0 && (
        <Card className="agent-result-card">
          <CardContent className="agent-result-card-body">
            <CardTitle className="agent-result-title">
              <ClipboardList size={16} /> 수정 권고 ({recommendedNextSteps.length})
            </CardTitle>
            <ol className="agent-result-list agent-result-list--ordered">
              {recommendedNextSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {policyFlags && policyFlags.length > 0 && (
        <Card className="agent-result-card">
          <CardContent className="agent-result-card-body">
            <CardTitle className="agent-result-title">
              <Tag size={16} /> 정책 플래그
            </CardTitle>
            <div className="agent-result-flags">
              {policyFlags.map((flag) => {
                const isProvenance = flag in PROVENANCE_FLAGS;
                return (
                  <span
                    key={flag}
                    className={getPolicyFlagClass(flag)}
                    title={isProvenance ? "분석 과정 정보 — 취약점 분류 아님" : undefined}
                  >
                    {formatPolicyFlag(flag)}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {scaLibraries && scaLibraries.length > 0 && (
        <Card className="agent-result-card">
          <CardContent className="agent-result-card-body">
            <CardTitle className="agent-result-title">
              <Package size={16} /> 서드파티 라이브러리 ({scaLibraries.length})
            </CardTitle>
            <div className="agent-result-table-wrap">
              <table className="agent-result-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>버전</th>
                    <th>경로</th>
                  </tr>
                </thead>
                <tbody>
                  {scaLibraries.map((lib) => (
                    <tr key={`${lib.name}-${lib.path}`}>
                      <td className="agent-result-table-name">
                        {lib.repoUrl ? (
                          <a
                            href={lib.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="agent-result-table-link"
                          >
                            {lib.name}
                          </a>
                        ) : (
                          lib.name
                        )}
                      </td>
                      <td className="agent-result-table-mono">
                        {lib.version ?? "—"}
                      </td>
                      <td className="agent-result-table-mono">{lib.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {agentAudit && (
        <Card className="agent-result-card">
          <CardContent className="agent-result-card-body">
            <button
              type="button"
              className="agent-result-audit-toggle"
              aria-expanded={auditOpen}
              onClick={() => setAuditOpen(!auditOpen)}
            >
              <ChevronRight
                size={14}
                className={cn("agent-result-audit-chevron", auditOpen && "is-open")}
              />
              <Cpu size={16} />
              에이전트 실행 정보
            </button>
            {auditOpen && (
              <div className="agent-result-audit-grid">
                <div className="agent-result-audit-item">
                  <span className="agent-result-audit-label">소요 시간</span>
                  <span className="agent-result-audit-value">
                    {(agentAudit.latencyMs / 1000).toFixed(1)}초
                  </span>
                </div>
                <div className="agent-result-audit-item">
                  <span className="agent-result-audit-label">프롬프트 토큰</span>
                  <span className="agent-result-audit-value">
                    {agentAudit.tokenUsage.prompt.toLocaleString()}
                  </span>
                </div>
                <div className="agent-result-audit-item">
                  <span className="agent-result-audit-label">응답 토큰</span>
                  <span className="agent-result-audit-value">
                    {agentAudit.tokenUsage.completion.toLocaleString()}
                  </span>
                </div>
                {agentAudit.turnCount != null && (
                  <div className="agent-result-audit-item">
                    <span className="agent-result-audit-label">턴 수</span>
                    <span className="agent-result-audit-value">{agentAudit.turnCount}</span>
                  </div>
                )}
                {agentAudit.toolCallCount != null && (
                  <div className="agent-result-audit-item">
                    <span className="agent-result-audit-label">도구 호출</span>
                    <span className="agent-result-audit-value">{agentAudit.toolCallCount}회</span>
                  </div>
                )}
                {agentAudit.terminationReason && (
                  <div className="agent-result-audit-item">
                    <span className="agent-result-audit-label">종료 사유</span>
                    <span className="agent-result-audit-value">
                      {formatTerminationReason(agentAudit.terminationReason)}
                    </span>
                  </div>
                )}
                {agentAudit.modelName && (
                  <div className="agent-result-audit-item">
                    <span className="agent-result-audit-label">LLM 모델</span>
                    <span className="agent-result-audit-value">{agentAudit.modelName}</span>
                  </div>
                )}
                {agentAudit.promptVersion && (
                  <div className="agent-result-audit-item">
                    <span className="agent-result-audit-label">프롬프트 버전</span>
                    <span className="agent-result-audit-value">{agentAudit.promptVersion}</span>
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
