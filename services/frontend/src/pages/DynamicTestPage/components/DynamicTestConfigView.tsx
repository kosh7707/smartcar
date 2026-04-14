import React from "react";
import type { Adapter, DynamicTestConfig, TestStrategy } from "@aegis/shared";
import { AlertTriangle, Bug, Play, Zap } from "lucide-react";
import { BackButton, PageHeader } from "../../../shared/ui";
import { AdapterSelector } from "../../../shared/ui";
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
}) => (
  <div className="page-enter">
    <BackButton onClick={onBack} label="이력으로" />
    <PageHeader title="새 세션" />

    <div className="card dtest-config">
      <div className="dtest-config__section">
        <label className="dtest-config__label">어댑터</label>
        {connected.length === 0 ? (
          <p className="dtest-config__hint" style={{ color: "var(--cds-support-error)" }}>연결된 어댑터가 없습니다</p>
        ) : (
          <AdapterSelector
            adapters={connected}
            selectedId={selectedAdapterId || null}
            onSelect={setSelectedAdapterId}
          />
        )}
      </div>

      <div className="dtest-config__section">
        <label className="dtest-config__label">테스트 유형</label>
        <div className="dtest-config__radio-group">
          <label className={`dtest-config__radio-card${testType === "fuzzing" ? " dtest-config__radio-card--selected" : ""}`}>
            <input type="radio" name="testType" checked={testType === "fuzzing"} onChange={() => setTestType("fuzzing")} />
            <Zap size={16} />
            <span>퍼징 (Fuzzing)</span>
          </label>
          <label className={`dtest-config__radio-card${testType === "pentest" ? " dtest-config__radio-card--selected" : ""}`}>
            <input type="radio" name="testType" checked={testType === "pentest"} onChange={() => setTestType("pentest")} />
            <Bug size={16} />
            <span>침투 테스트 (Pentest)</span>
          </label>
        </div>
      </div>

      <div className="dtest-config__section">
        <label className="dtest-config__label">대상 설정</label>
        {hasEcuMeta && ecuMeta ? (
          <div className="dtest-config__field-row">
            <label className="form-field">
              <span className="form-label">Target ECU</span>
              <input className="form-input" value={targetEcu} readOnly />
            </label>
            <label className="form-field">
              <span className="form-label">Target ID</span>
              <select className="filter-select" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {ecuMeta.canIds.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="dtest-config__field-row">
            <label className="form-field">
              <span className="form-label">Target ECU</span>
              <input className="form-input" value={targetEcu} onChange={(e) => setTargetEcu(e.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-label">Target ID</span>
              <input className="form-input" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="0x100" />
            </label>
          </div>
        )}
      </div>

      <div className="dtest-config__section">
        <label className="dtest-config__label">전략</label>
        <div className="dtest-config__radio-group">
          {(["random", "boundary", "scenario"] as TestStrategy[]).map((s) => (
            <label key={s} className={`dtest-config__radio-card${strategy === s ? " dtest-config__radio-card--selected" : ""}`}>
              <input type="radio" name="strategy" checked={strategy === s} onChange={() => setStrategy(s)} />
              <span>{STRATEGY_LABELS[s]}</span>
            </label>
          ))}
        </div>
      </div>

      {strategy === "random" ? (
        <div className="dtest-config__section">
          <label className="dtest-config__label">입력 수</label>
          <input
            type="number"
            className="form-input dtest-config__count-input"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value))))}
          />
          <span className="dtest-config__hint">1 ~ 1,000</span>
        </div>
      ) : (
        <div className="dtest-config__section">
          <span className="dtest-config__hint">
            고정 입력 세트: {strategy === "boundary" ? "12개 (경계값 + DLC 변형)" : "20개 (DoS/진단/리플레이/파괴적)"}
          </span>
        </div>
      )}

      <div className="dtest-config__section">
        <label className="dtest-config__label">요약</label>
        <div className="dtest-config__mode-card">
          {testType === "fuzzing" ? <Zap size={16} /> : <Bug size={16} />}
          <div>
            <div className="dtest-config__mode-title">
              {testType === "fuzzing" ? "퍼징" : "침투 테스트"} — {STRATEGY_LABELS[strategy]}
            </div>
            <p className="dtest-config__mode-desc">
              {testType === "fuzzing"
                ? strategy === "random"
                  ? `무작위 데이터 ${count}개를 생성하여 ${targetEcu}에 전송합니다. 예기치 않은 크래시나 이상 응답을 탐지합니다.`
                  : strategy === "boundary"
                    ? `경계값과 DLC 변형 12개를 ${targetEcu}에 전송하여 입력 검증 취약점을 탐지합니다.`
                    : `DoS, 진단, 리플레이 등 20개 공격 시나리오를 ${targetEcu}에 실행합니다.`
                : `알려진 공격 벡터를 기반으로 ${targetEcu}의 보안 취약점을 능동적으로 탐지합니다.`}
              {" "}프로토콜: CAN · 대상 ID: {targetId}
            </p>
          </div>
        </div>
      </div>

      <div className="dtest-config__actions">
        <button className="btn" onClick={onStart} disabled={!targetEcu.trim() || !targetId.trim() || !selectedAdapterId}>
          <Play size={16} />
          테스트 시작
        </button>
      </div>
    </div>

    {error && (
      <div className="card dtest-error animate-fade-in">
        <AlertTriangle size={16} />
        <span>{error}</span>
      </div>
    )}
  </div>
);
