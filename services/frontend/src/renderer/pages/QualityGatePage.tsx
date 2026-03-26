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

const RULE_LABELS: Record<string, string> = {
  "no-critical": "Critical 취약점 없음",
  "high-threshold": "High 취약점 임계치",
  "evidence-coverage": "증거 충분성",
  "sandbox-unreviewed": "미검토 항목 없음",
};

function RuleResultRow({ rule }: { rule: GateRuleResult }) {
  const icon = rule.result === "passed"
    ? <CheckCircle size={14} className="rule-icon--passed" />
    : rule.result === "failed"
    ? <XCircle size={14} className="rule-icon--failed" />
    : <AlertTriangle size={14} className="rule-icon--warning" />;

  return (
    <div className={`gate-rule gate-rule--${rule.result}`}>
      {icon}
      <span className="gate-rule__name">{RULE_LABELS[rule.ruleId] ?? rule.ruleId}</span>
      <span className="gate-rule__message">{rule.message}</span>
      {rule.linkedFindingIds.length > 0 && (
        <span className="gate-rule__findings">Finding {rule.linkedFindingIds.length}건</span>
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
                  {gate.rules.map((rule) => (
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
                        <input
                          type="text"
                          className="input input-sm"
                          placeholder="오버라이드 사유를 입력하세요"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleOverride()}
                        />
                        <button className="btn btn-sm" onClick={handleOverride} disabled={overriding || !overrideReason.trim()}>
                          {overriding ? "처리 중..." : "확인"}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setOverrideTarget(null); setOverrideReason(""); }}>
                          취소
                        </button>
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
