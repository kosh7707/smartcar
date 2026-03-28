import React, { useState } from "react";
import type { AnalysisResult } from "@aegis/shared";
import {
  Target,
  AlertTriangle,
  ClipboardList,
  Tag,
  Package,
  Cpu,
  ChevronRight,
} from "lucide-react";
import { highlightCVEs } from "../../utils/cveHighlight";
import "./AgentResultPanel.css";

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

  // If no agent-specific data, don't render anything
  const hasAgentData =
    confidenceScore != null ||
    caveats?.length ||
    recommendedNextSteps?.length ||
    policyFlags?.length ||
    scaLibraries?.length ||
    agentAudit;

  if (!hasAgentData) return null;

  return (
    <div className="agent-panel">
      {/* Confidence gauge */}
      {confidenceScore != null && (
        <div className="card">
          <div className="card-title">
            <Target size={16} />
            분석 신뢰도
          </div>
          <div className="agent-confidence">
            <div className="agent-confidence__score">
              <span className="agent-confidence__value">
                {(confidenceScore * 100).toFixed(1)}%
              </span>
              <span className="agent-confidence__label">신뢰도</span>
              {needsHumanReview && (
                <span className="agent-confidence__review">
                  <AlertTriangle size={11} />
                  검토 필요
                </span>
              )}
            </div>
            {confidenceBreakdown && (
              <div className="agent-confidence__bars">
                {BREAKDOWN_LABELS.map(({ key, label }) => {
                  const value = (confidenceBreakdown as Record<string, number>)[key] ?? 0;
                  return (
                    <div key={key} className="agent-conf-bar">
                      <span className="agent-conf-bar__label">{label}</span>
                      <div className="agent-conf-bar__track">
                        <div
                          className="agent-conf-bar__fill"
                          style={{ width: `${value * 100}%` }}
                        />
                      </div>
                      <span className="agent-conf-bar__value">
                        {(value * 100).toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Caveats */}
      {caveats && caveats.length > 0 && (
        <div className="card">
          <div className="card-title">
            <AlertTriangle size={16} />
            분석 한계 ({caveats.length})
          </div>
          <ul className="agent-caveats__list">
            {caveats.map((c, i) => (
              <li key={i}>{highlightCVEs(c)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended next steps */}
      {recommendedNextSteps && recommendedNextSteps.length > 0 && (
        <div className="card">
          <div className="card-title">
            <ClipboardList size={16} />
            수정 권고 ({recommendedNextSteps.length})
          </div>
          <ol className="agent-steps__list">
            {recommendedNextSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Policy flags */}
      {policyFlags && policyFlags.length > 0 && (
        <div className="card">
          <div className="card-title">
            <Tag size={16} />
            정책 플래그
          </div>
          <div className="agent-flags">
            {policyFlags.map((flag) => {
              const isCve = flag.startsWith("CVE-");
              const isCwe = flag.startsWith("CWE-");
              const cls = isCve
                ? "agent-flag agent-flag--cve"
                : isCwe
                  ? "agent-flag agent-flag--cwe"
                  : "agent-flag";
              return (
                <span key={flag} className={cls}>
                  {flag}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* SCA libraries */}
      {scaLibraries && scaLibraries.length > 0 && (
        <div className="card">
          <div className="card-title">
            <Package size={16} />
            서드파티 라이브러리 ({scaLibraries.length})
          </div>
          <table className="agent-sca-table">
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
                  <td>
                    {lib.repoUrl ? (
                      <a
                        href={lib.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="agent-sca-link"
                      >
                        {lib.name}
                      </a>
                    ) : (
                      lib.name
                    )}
                  </td>
                  <td className="font-mono">{lib.version ?? "—"}</td>
                  <td className="font-mono">{lib.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Agent audit (collapsible) */}
      {agentAudit && (
        <div className="card">
          <button
            className="agent-audit-toggle"
            aria-expanded={auditOpen}
            onClick={() => setAuditOpen(!auditOpen)}
          >
            <ChevronRight
              size={14}
              style={{
                transform: auditOpen ? "rotate(90deg)" : "none",
                transition: "transform 0.15s",
              }}
            />
            <Cpu size={16} />
            에이전트 실행 정보
          </button>
          {auditOpen && (
            <div className="agent-audit-grid">
              <div className="agent-audit-item">
                <span className="agent-audit-item__label">소요 시간</span>
                <span className="agent-audit-item__value">
                  {(agentAudit.latencyMs / 1000).toFixed(1)}초
                </span>
              </div>
              <div className="agent-audit-item">
                <span className="agent-audit-item__label">프롬프트 토큰</span>
                <span className="agent-audit-item__value">
                  {agentAudit.tokenUsage.prompt.toLocaleString()}
                </span>
              </div>
              <div className="agent-audit-item">
                <span className="agent-audit-item__label">응답 토큰</span>
                <span className="agent-audit-item__value">
                  {agentAudit.tokenUsage.completion.toLocaleString()}
                </span>
              </div>
              {agentAudit.turnCount != null && (
                <div className="agent-audit-item">
                  <span className="agent-audit-item__label">턴 수</span>
                  <span className="agent-audit-item__value">{agentAudit.turnCount}</span>
                </div>
              )}
              {agentAudit.toolCallCount != null && (
                <div className="agent-audit-item">
                  <span className="agent-audit-item__label">도구 호출</span>
                  <span className="agent-audit-item__value">{agentAudit.toolCallCount}회</span>
                </div>
              )}
              {agentAudit.terminationReason && (
                <div className="agent-audit-item">
                  <span className="agent-audit-item__label">종료 사유</span>
                  <span className="agent-audit-item__value">{agentAudit.terminationReason}</span>
                </div>
              )}
              {agentAudit.modelName && (
                <div className="agent-audit-item">
                  <span className="agent-audit-item__label">LLM 모델</span>
                  <span className="agent-audit-item__value font-mono">{agentAudit.modelName}</span>
                </div>
              )}
              {agentAudit.promptVersion && (
                <div className="agent-audit-item">
                  <span className="agent-audit-item__label">프롬프트 버전</span>
                  <span className="agent-audit-item__value font-mono">{agentAudit.promptVersion}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
