import React from "react";
import type { Adapter, TestStrategy } from "@aegis/shared";
import { AlertTriangle, Bug, Play, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdapterSelector, BackButton, PageHeader } from "../../../shared/ui";
import { STRATEGY_LABELS } from "../dynamicTestPresentation";

interface DynamicTestConfigViewProps {
  connected: Adapter[];
  selectedAdapterId: string;
  setSelectedAdapterId: (id: string) => void;
  testType: "fuzzing" | "pentest";
  setTestType: (type: "fuzzing" | "pentest") => void;
  strategy: TestStrategy;
  setStrategy: (strategy: TestStrategy) => void;
  targetEcu: string;
  setTargetEcu: (value: string) => void;
  targetId: string;
  setTargetId: (value: string) => void;
  count: number;
  setCount: (value: number) => void;
  hasEcuMeta: boolean;
  ecuMeta?: { name: string; canIds: string[] } | null;
  error: string | null;
  onBack: () => void;
  onStart: () => void;
}

const CONFIG_CARD_CLASS = "dynamic-test-option-card";

export const DynamicTestConfigView: React.FC<DynamicTestConfigViewProps> = ({
  connected,
  selectedAdapterId,
  setSelectedAdapterId,
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
  hasEcuMeta,
  ecuMeta,
  error,
  onBack,
  onStart,
}) => {
  const selectClassName = "build-profile-select";

  return (
    <div className="dynamic-test-config">
      <BackButton onClick={onBack} label="이력으로" />
      <PageHeader title="새 세션" />

      <div className="panel dynamic-test-config-card">
        <div className="panel-body">
          <section className="dynamic-test-section">
            <p className="dynamic-test-section-title">어댑터</p>
            {connected.length === 0 ? (
              <div className="panel panel-alert">
                <AlertTriangle size={16} />
                <strong className="alert-title">연결된 어댑터가 없습니다</strong>
                <span className="alert-description">프로젝트 설정에서 어댑터를 연결한 뒤 테스트를 시작하세요.</span>
              </div>
            ) : (
              <AdapterSelector adapters={connected} selectedId={selectedAdapterId || null} onSelect={setSelectedAdapterId} />
            )}
          </section>

          <section className="dynamic-test-section">
            <p className="dynamic-test-section-title">테스트 유형</p>
            <div role="radiogroup" value={testType} onValueChange={(value) => setTestType(value as "fuzzing" | "pentest")} className="dynamic-test-option-grid dynamic-test-option-grid--2">
              {[
                { value: "fuzzing" as const, icon: <Zap size={16} className="dynamic-test-option-icon" />, label: "퍼징 (Fuzzing)", description: "랜덤·경계값 기반 입력으로 비정상 반응을 탐지합니다." },
                { value: "pentest" as const, icon: <Bug size={16} className="dynamic-test-option-icon" />, label: "침투 테스트 (Pentest)", description: "알려진 공격 벡터를 순차 실행합니다." },
              ].map((option) => (
                <label className={"form-label" + " " + cn(CONFIG_CARD_CLASS, testType === option.value && "is-active")} key={option.value} htmlFor={`dynamic-test-type-${option.value}`}>
                  <input type="radio" id={`dynamic-test-type-${option.value}`} value={option.value} />
                  <div className="dynamic-test-option-copy">
                    <div className="dynamic-test-option-title">{option.icon}<span>{option.label}</span></div>
                    <p className="dynamic-test-option-desc">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="dynamic-test-section">
            <p className="dynamic-test-section-title">대상 설정</p>
            {hasEcuMeta && ecuMeta ? (
              <div className="dynamic-test-field-grid">
                <label className="form-label dynamic-test-field">
                  <span className="dynamic-test-field-label">Target ECU</span>
                  <input className="form-input" value={targetEcu} readOnly />
                </label>
                <label className="form-label dynamic-test-field">
                  <span className="dynamic-test-field-label">Target ID</span>
                  <select className={selectClassName} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                    {ecuMeta.canIds.map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                </label>
              </div>
            ) : (
              <div className="dynamic-test-field-grid">
                <label className="form-label dynamic-test-field">
                  <span className="dynamic-test-field-label">Target ECU</span>
                  <input className="form-input" value={targetEcu} onChange={(e) => setTargetEcu(e.target.value)} />
                </label>
                <label className="form-label dynamic-test-field">
                  <span className="dynamic-test-field-label">Target ID</span>
                  <input className="form-input" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="0x100" />
                </label>
              </div>
            )}
          </section>

          <section className="dynamic-test-section">
            <p className="dynamic-test-section-title">전략</p>
            <div role="radiogroup" value={strategy} onValueChange={(value) => setStrategy(value as TestStrategy)} className="dynamic-test-option-grid dynamic-test-option-grid--3">
              {(["random", "boundary", "scenario"] as TestStrategy[]).map((value) => (
                <label className={"form-label" + " " + cn(CONFIG_CARD_CLASS, strategy === value && "is-active")} key={value} htmlFor={`dynamic-test-strategy-${value}`}>
                  <input type="radio" id={`dynamic-test-strategy-${value}`} value={value} />
                  <span className="dynamic-test-option-title">{STRATEGY_LABELS[value]}</span>
                </label>
              ))}
            </div>
          </section>

          {strategy === "random" ? (
            <section className="dynamic-test-section">
              <label className="form-label dynamic-test-count-field">
                <span className="dynamic-test-field-label">입력 수</span>
                <input className="form-input" type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value))))} />
              </label>
              <p className="dynamic-test-field-note">1 ~ 1,000</p>
            </section>
          ) : (
            <section className="dynamic-test-section">
              <p className="dynamic-test-field-note">고정 입력 세트: {strategy === "boundary" ? "12개 (경계값 + DLC 변형)" : "20개 (DoS/진단/리플레이/파괴적)"}</p>
            </section>
          )}

          <section className="dynamic-test-section">
            <p className="dynamic-test-section-title">요약</p>
            <div className="panel dynamic-test-summary">
              <div className="panel-body">
                {testType === "fuzzing" ? <Zap size={16} className="dynamic-test-summary-icon" /> : <Bug size={16} className="dynamic-test-summary-icon" />}
                <div className="dynamic-test-summary-copy">
                  <div className="dynamic-test-section-title">{testType === "fuzzing" ? "퍼징" : "침투 테스트"} — {STRATEGY_LABELS[strategy]}</div>
                  <p className="dynamic-test-option-desc">
                    {testType === "fuzzing"
                      ? strategy === "random"
                        ? `무작위 데이터 ${count}개를 생성하여 ${targetEcu}에 전송합니다. 예기치 않은 크래시나 이상 응답을 탐지합니다.`
                        : strategy === "boundary"
                          ? `경계값과 DLC 변형 12개를 ${targetEcu}에 전송하여 입력 검증 취약점을 탐지합니다.`
                          : `DoS, 진단, 리플레이 등 20개 공격 시나리오를 ${targetEcu}에 실행합니다.`
                      : `알려진 공격 벡터를 기반으로 ${targetEcu}의 보안 취약점을 능동적으로 탐지합니다.`} 프로토콜: CAN · 대상 ID: {targetId}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div>
            <button type="button" className="btn btn-primary" onClick={onStart} disabled={!targetEcu.trim() || !targetId.trim() || !selectedAdapterId}><Play size={16} /> 테스트 시작</button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="panel panel-alert dynamic-test-error">
          <AlertTriangle size={16} />
          <strong className="alert-title">테스트 시작 실패</strong>
          <span className="alert-description">{error}</span>
        </div>
      ) : null}
    </div>
  );
};
