import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import type { GateResult, GateRuleResult } from "../api/gate";
import { fetchProjectGates, overrideGate } from "../api/gate";
import { logError } from "../api/core";
import { useToast } from "../contexts/ToastContext";
import { PageHeader, Spinner, EmptyState } from "../components/ui";
import { formatDateTime } from "../utils/format";
import "./QualityGatePage.css";

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  pass: { icon: <ShieldCheck size={16} />, label: "통과", className: "gate-status--pass" },
  fail: { icon: <ShieldX size={16} />, label: "실패", className: "gate-status--fail" },
  warning: { icon: <ShieldAlert size={16} />, label: "경고", className: "gate-status--warning" },
};

const RULE_INFO: Record<string, { label: string; description: string }> = {
  "no-critical": { label: "Critical 취약점 없음", description: "Critical 수준 취약점이 0건이어야 합니다" },
  "high-threshold": { label: "High 취약점 임계치", description: "High 수준 취약점이 설정된 임계값 이하여야 합니다" },
  "evidence-coverage": { label: "증거 충분성", description: "모든 Finding에 1개 이상의 증적이 연결되어 있어야 합니다" },
  "sandbox-unreviewed": { label: "미검토 항목 없음", description: "Sandbox 상태의 미검토 Finding이 0건이어야 합니다" },
};

function RuleResultRow({ rule }: { rule: GateRuleResult }) {
  const icon = rule.result === "passed"
    ? <CheckCircle size={14} className="rule-icon--passed" />
    : rule.result === "failed"
    ? <XCircle size={14} className="rule-icon--failed" />
    : <AlertTriangle size={14} className="rule-icon--warning" />;

  return (
    <div className={`gate-rule gate-rule--${rule.result}`}>
      <div className="gate-rule__main">
        {icon}
        <span className="gate-rule__name">{RULE_INFO[rule.ruleId]?.label ?? rule.ruleId}</span>
        <span className="gate-rule__message">{rule.message}</span>
        {rule.linkedFindingIds.length > 0 && (
          <span className="gate-rule__findings">Finding {rule.linkedFindingIds.length}건</span>
        )}
      </div>
      {RULE_INFO[rule.ruleId]?.description && (
        <div className="gate-rule__description" style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
          {RULE_INFO[rule.ruleId].description}
        </div>
      )}
    </div>
  );
}

export const QualityGatePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();
  const [gates, setGates] = useState<GateResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchProjectGates(projectId);
      setGates(data.sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()));
    } catch (e) {
      logError("Load quality gates", e);
      toast.error("Quality Gate 결과를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { load(); }, [load]);

  const handleOverride = useCallback(async () => {
    if (!overrideTarget || !overrideReason.trim()) return;
    setOverriding(true);
    try {
      await overrideGate(overrideTarget, overrideReason.trim());
      toast.success("Quality Gate 오버라이드 완료");
      setOverrideTarget(null);
      setOverrideReason("");
      load();
    } catch (e) {
      logError("Override gate", e);
      toast.error("오버라이드에 실패했습니다.");
    } finally {
      setOverriding(false);
    }
  }, [overrideTarget, overrideReason, toast, load]);

  if (loading) {
    return <div className="page-enter centered-loader"><Spinner size={36} label="Quality Gate 로딩 중..." /></div>;
  }

  return (
    <div className="page-enter">
      <PageHeader title="Quality Gate" icon={<ShieldCheck size={20} />} />

      {gates.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={28} />}
          title="아직 Quality Gate 결과가 없습니다"
          description="분석을 실행하면 자동으로 Quality Gate가 평가됩니다."
        />
      ) : (
        <div className="gate-list">
          {gates.map((gate) => {
            const config = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.warning;
            return (
              <div key={gate.id} className="gate-card card">
                <div className="gate-card__header">
                  <div className={`gate-card__status ${config.className}`}>
                    {config.icon}
                    <span>{config.label}</span>
                  </div>
                  <span className="gate-card__time">
                    <Clock size={12} /> {formatDateTime(gate.evaluatedAt)}
                  </span>
                </div>

                <div className="gate-card__rules">
                  {[...gate.rules].sort((a, b) => {
                    const order: Record<string, number> = { failed: 0, warning: 1, passed: 2 };
                    return (order[a.result] ?? 9) - (order[b.result] ?? 9);
                  }).map((rule) => (
                    <RuleResultRow key={rule.ruleId} rule={rule} />
                  ))}
                </div>

                {gate.override && (
                  <div className="gate-card__override">
                    <AlertTriangle size={12} />
                    <span>오버라이드: {gate.override.reason}</span>
                    <span className="gate-card__override-by">by {gate.override.overriddenBy}</span>
                  </div>
                )}

                {gate.status === "fail" && !gate.override && (
                  <div className="gate-card__actions">
                    {overrideTarget === gate.id ? (
                      <div className="gate-override-form">
                        {(() => {
                          const failedCount = gate.rules.filter(r => r.result === "failed").length;
                          return failedCount > 0 ? (
                            <div className="gate-override-form__warning">
                              <AlertTriangle size={14} />
                              이 오버라이드로 {failedCount}건의 실패 규칙이 무시됩니다
                            </div>
                          ) : null;
                        })()}
                        <div className="gate-override-form__controls">
                          <input
                            type="text"
                            className="input input-sm"
                            placeholder="오버라이드 사유를 입력하세요 (최소 10자)"
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && overrideReason.trim().length >= 10 && handleOverride()}
                          />
                          <button
                            className="btn btn-sm confirm-dialog__btn--danger"
                            style={{ background: 'var(--danger)', color: 'var(--text-inverse)' }}
                            onClick={handleOverride}
                            disabled={overriding || overrideReason.trim().length < 10}
                          >
                            {overriding ? "처리 중..." : "오버라이드 확인"}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setOverrideTarget(null); setOverrideReason(""); }}>
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => setOverrideTarget(gate.id)}>
                        오버라이드
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
