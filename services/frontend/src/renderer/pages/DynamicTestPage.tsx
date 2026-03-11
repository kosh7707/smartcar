import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import type { DynamicTestConfig, DynamicTestResult, DynamicTestFinding, TestStrategy } from "@smartcar/shared";
import {
  FlaskConical,
  Plus,
  Play,
  Trash2,
  AlertTriangle,
  Bug,
  Clock,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { getDynamicTestResults, getDynamicTestResult, deleteDynamicTestResult } from "../api/client";
import { useDynamicTest, type TestProgress } from "../hooks/useDynamicTest";
import { useAdapters } from "../hooks/useAdapters";
import { PageHeader, EmptyState, ListItem, SeverityBadge, StatCard, Spinner, BackButton, AdapterSelector } from "../components/ui";
import { formatDateTime } from "../utils/format";
import "./DynamicTestPage.css";

const STRATEGY_LABELS: Record<TestStrategy, string> = {
  random: "랜덤 퍼징",
  boundary: "경계값 분석",
  scenario: "공격 시나리오",
};

const FINDING_TYPE_ICON: Record<string, React.ReactNode> = {
  crash: <Bug size={14} />,
  anomaly: <AlertTriangle size={14} />,
  timeout: <Clock size={14} />,
};

const FINDING_TYPE_LABEL: Record<string, string> = {
  crash: "Crash",
  anomaly: "Anomaly",
  timeout: "Timeout",
};

export const DynamicTestPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { connected, hasConnected } = useAdapters(projectId);
  const test = useDynamicTest(projectId!);

  const [history, setHistory] = useState<DynamicTestResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [adapterWarning, setAdapterWarning] = useState(false);

  // Config form state
  const [testType, setTestType] = useState<"fuzzing" | "pentest">("fuzzing");
  const [strategy, setStrategy] = useState<TestStrategy>("random");
  const [targetEcu, setTargetEcu] = useState("ECU-01");
  const [targetId, setTargetId] = useState("0x100");
  const [count, setCount] = useState(50);
  const [selectedAdapterId, setSelectedAdapterId] = useState<string>("");

  const loadHistory = () => {
    getDynamicTestResults(projectId!)
      .then(setHistory)
      .catch((e) => console.error("Failed to load test history:", e))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  // Auto-select adapter if only one connected
  useEffect(() => {
    if (connected.length === 1 && !selectedAdapterId) {
      setSelectedAdapterId(connected[0].id);
    }
  }, [connected, selectedAdapterId]);

  // Auto-populate from ecuMeta when adapter is selected
  const selectedAdapter = connected.find((a) => a.id === selectedAdapterId);
  const ecuMeta = selectedAdapter?.ecuMeta?.[0];
  const hasEcuMeta = !!ecuMeta;

  useEffect(() => {
    if (!selectedAdapterId) return;
    if (ecuMeta) {
      setTargetEcu(ecuMeta.name);
      setTargetId(ecuMeta.canIds[0] ?? "0x100");
    }
  }, [selectedAdapterId]);

  const handleStart = () => {
    if (!selectedAdapterId) return;
    const config: DynamicTestConfig = {
      testType,
      strategy,
      targetEcu: targetEcu.trim(),
      protocol: "CAN",
      targetId: targetId.trim(),
      ...(strategy === "random" ? { count } : {}),
    };
    setShowConfig(false);
    test.startTest(config, selectedAdapterId);
  };

  const handleDelete = async (r: DynamicTestResult) => {
    if (!confirm(`이 테스트 결과를 삭제하시겠습니까?`)) return;
    try {
      await deleteDynamicTestResult(r.id);
      setHistory((prev) => prev.filter((h) => h.id !== r.id));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleViewResult = async (r: DynamicTestResult) => {
    try {
      const detail = await getDynamicTestResult(r.id);
      test.viewResult(detail);
    } catch (e) {
      console.error("Failed to load result:", e);
    }
  };

  const handleNewTest = () => {
    test.reset();
    setShowConfig(false);
    loadHistory();
  };

  // ── Running view ──
  if (test.view === "running") {
    return <RunningView progress={test.progress} findings={test.findings} />;
  }

  // ── Results view ──
  if (test.view === "results" && test.result) {
    return (
      <ResultsView
        result={test.result}
        onNewTest={handleNewTest}
      />
    );
  }

  // ── Config view (new test form) ──
  if (showConfig) {
    return (
      <div className="page-enter">
        <BackButton onClick={() => setShowConfig(false)} label="이력으로" />
        <PageHeader title="새 세션" icon={<FlaskConical size={20} />} />

        <div className="card dtest-config">
          {/* Adapter selection */}
          <div className="dtest-config__section">
            <label className="dtest-config__label">어댑터</label>
            {connected.length === 0 ? (
              <p className="dtest-config__hint" style={{ color: "var(--danger)" }}>연결된 어댑터가 없습니다</p>
            ) : (
              <AdapterSelector
                adapters={connected}
                selectedId={selectedAdapterId || null}
                onSelect={setSelectedAdapterId}
              />
            )}
          </div>

          {/* Test type */}
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

          {/* Target */}
          <div className="dtest-config__section">
            <label className="dtest-config__label">대상 설정</label>
            {hasEcuMeta ? (
              <div className="dtest-config__field-row">
                <label className="form-field">
                  <span className="form-label">Target ECU</span>
                  <input className="form-input" value={targetEcu} readOnly />
                </label>
                <label className="form-field">
                  <span className="form-label">Target ID</span>
                  <select className="filter-select" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                    {ecuMeta!.canIds.map((id) => (
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

          {/* Strategy */}
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

          {/* Count (only for random) */}
          {strategy === "random" ? (
            <div className="dtest-config__section">
              <label className="dtest-config__label">입력 수</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={1000}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value))))}
                style={{ maxWidth: 140 }}
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

          {/* Mode summary */}
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
            <button className="btn" onClick={handleStart} disabled={!targetEcu.trim() || !targetId.trim() || !selectedAdapterId}>
              <Play size={16} />
              테스트 시작
            </button>
          </div>
        </div>

        {test.error && (
          <div className="card dtest-error animate-fade-in">
            <AlertTriangle size={16} />
            <span>{test.error}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Default: history list ──
  return (
    <div className="page-enter">
      <PageHeader
        title="동적 테스트"
        icon={<FlaskConical size={20} />}
        action={
          <button className="btn" onClick={() => {
            if (!hasConnected) { setAdapterWarning(true); return; }
            setAdapterWarning(false);
            setShowConfig(true);
          }}>
            <Plus size={16} />
            새 세션
          </button>
        }
      />

      {adapterWarning && (
        <div className="adapter-warning card animate-fade-in">
          <AlertTriangle size={16} />
          <span>연결된 어댑터가 없습니다. <a href={`#/projects/${projectId}/settings`}>프로젝트 설정</a>에서 어댑터를 연결해주세요.</span>
        </div>
      )}

      {historyLoading ? (
        <div className="centered-loader" style={{ paddingTop: "var(--space-10)" }}>
          <Spinner label="이력 로딩 중..." />
        </div>
      ) : history.length === 0 ? (
        <EmptyState
          icon={<FlaskConical size={28} />}
          title="아직 테스트 이력이 없습니다"
          description="ECU에 퍼징/침투 테스트를 실행하고 취약점을 탐지합니다"
          action={
            <button className="btn" onClick={() => {
              if (!hasConnected) { setAdapterWarning(true); return; }
              setAdapterWarning(false);
              setShowConfig(true);
            }}>
              첫 세션 시작
            </button>
          }
        />
      ) : (
        <div className="card">
          {history.map((r) => (
            <ListItem
              key={r.id}
              onClick={() => handleViewResult(r)}
              trailing={
                <>
                  <span className="analysis-item__time">{formatDateTime(r.createdAt)}</span>
                  <button
                    className="btn-icon btn-danger analysis-item__delete"
                    title="삭제"
                    onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              }
            >
              <div>
                <div className="analysis-item__header">
                  <span className="analysis-item__badge analysis-item__badge--test">
                    {r.config.testType === "fuzzing" ? <Zap size={11} /> : <Bug size={11} />}
                    {r.config.testType === "fuzzing" ? "퍼징" : "침투"}
                  </span>
                  <span className="analysis-item__label">{STRATEGY_LABELS[r.config.strategy]}</span>
                  <span className="analysis-item__stat">{r.totalRuns}회</span>
                  {r.crashes > 0 && <span className="analysis-item__stat analysis-item__stat--danger">Crash {r.crashes}</span>}
                  {r.anomalies > 0 && <span className="analysis-item__stat analysis-item__stat--warn">Anomaly {r.anomalies}</span>}
                </div>
                <div className="analysis-item__sub">
                  {r.config.targetEcu} · {r.config.protocol} · {r.config.targetId}
                </div>
              </div>
            </ListItem>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Performance Chart ──

interface ChartSnapshot {
  step: number;
  crashes: number;
  anomalies: number;
}

const PerformanceChart: React.FC<{ snapshots: ChartSnapshot[]; total: number }> = ({ snapshots, total }) => {
  if (snapshots.length < 2) {
    return (
      <div className="dtest-chart-empty">
        <Spinner size={14} />
        <span>데이터 수집 중...</span>
      </div>
    );
  }

  const W = 480, H = 180;
  const PAD = { top: 24, right: 16, bottom: 28, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const rawMax = Math.max(1, ...snapshots.map((s) => Math.max(s.crashes, s.anomalies)));
  const niceMax = rawMax <= 5 ? rawMax : Math.ceil(rawMax / 5) * 5;

  const x = (step: number) => PAD.left + (step / Math.max(total, 1)) * plotW;
  const y = (val: number) => PAD.top + plotH - (val / niceMax) * plotH;

  const toPolyline = (key: "crashes" | "anomalies") =>
    snapshots.map((s) => `${x(s.step)},${y(s[key])}`).join(" ");

  const toArea = (key: "crashes" | "anomalies") => {
    const base = y(0);
    return (
      `M${x(snapshots[0].step)},${base} ` +
      snapshots.map((s) => `L${x(s.step)},${y(s[key])}`).join(" ") +
      ` L${x(snapshots[snapshots.length - 1].step)},${base} Z`
    );
  };

  const yTicks =
    niceMax <= 5
      ? Array.from({ length: niceMax + 1 }, (_, i) => i)
      : [0, Math.round(niceMax / 4), Math.round(niceMax / 2), Math.round((niceMax * 3) / 4), niceMax];

  const last = snapshots[snapshots.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dtest-chart">
      {/* Grid */}
      {yTicks.map((v) => (
        <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border-subtle)" strokeWidth={0.5} />
      ))}
      {/* Y labels */}
      {yTicks.map((v) => (
        <text key={`yl-${v}`} x={PAD.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--text-tertiary)">
          {v}
        </text>
      ))}
      {/* X labels */}
      <text x={PAD.left} y={H - 6} fontSize="10" fill="var(--text-tertiary)">0</text>
      <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="10" fill="var(--text-tertiary)">{total}</text>
      <text x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-tertiary)">테스트 진행 (iterations)</text>
      {/* Area fills */}
      <path d={toArea("anomalies")} fill="var(--severity-medium)" opacity={0.08} />
      <path d={toArea("crashes")} fill="var(--danger)" opacity={0.1} />
      {/* Lines */}
      <polyline points={toPolyline("anomalies")} fill="none" stroke="var(--severity-medium)" strokeWidth={2} strokeLinejoin="round" />
      <polyline points={toPolyline("crashes")} fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinejoin="round" />
      {/* Current dots */}
      <circle cx={x(last.step)} cy={y(last.crashes)} r={3.5} fill="var(--danger)">
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={x(last.step)} cy={y(last.anomalies)} r={3.5} fill="var(--severity-medium)">
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
      </circle>
      {/* Legend */}
      <rect x={W - PAD.right - 140} y={4} width={136} height={18} rx={4} fill="var(--surface-0)" stroke="var(--border-subtle)" strokeWidth={0.5} />
      <circle cx={W - PAD.right - 128} cy={13} r={3} fill="var(--danger)" />
      <text x={W - PAD.right - 122} y={13} dominantBaseline="middle" fontSize="10" fill="var(--text-secondary)">Crashes</text>
      <circle cx={W - PAD.right - 68} cy={13} r={3} fill="var(--severity-medium)" />
      <text x={W - PAD.right - 62} y={13} dominantBaseline="middle" fontSize="10" fill="var(--text-secondary)">Anomalies</text>
    </svg>
  );
};

// ── Running View ──

interface RunningViewProps {
  progress: TestProgress;
  findings: DynamicTestFinding[];
}

const RunningView: React.FC<RunningViewProps> = ({ progress, findings }) => {
  const logRef = useRef<HTMLDivElement>(null);
  const [snapshots, setSnapshots] = useState<ChartSnapshot[]>([]);
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  // Accumulate snapshots for chart
  useEffect(() => {
    setSnapshots((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].step === progress.current) return prev;
      return [...prev, { step: progress.current, crashes: progress.crashes, anomalies: progress.anomalies }];
    });
  }, [progress.current, progress.crashes, progress.anomalies]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [findings.length]);

  return (
    <div className="page-enter">
      <PageHeader title="동적 테스트" icon={<FlaskConical size={20} />} subtitle="테스트 진행 중..." />

      {/* Stat cards */}
      <div className="stat-cards stagger">
        <StatCard icon={<Play size={16} />} label="진행" value={`${progress.current} / ${progress.total}`} accent />
        <StatCard icon={<Bug size={16} />} label="Crashes" value={progress.crashes} color="var(--danger)" />
        <StatCard icon={<AlertTriangle size={16} />} label="Anomalies" value={progress.anomalies} color="var(--severity-medium)" />
        <StatCard icon={<Clock size={16} />} label="Findings" value={findings.length} accent />
      </div>

      {/* Progress bar */}
      <div className="card dtest-running-bar">
        <div className="dtest-running__bar-wrap">
          <div className="dtest-running__bar-track">
            <div className="dtest-running__bar-fill shimmer-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="dtest-running__pct">{pct}%</span>
        </div>
        <p className="dtest-running__message">{progress.message}</p>
      </div>

      {/* Grid: Chart + Findings */}
      <div className="dtest-running-grid">
        <div className="card">
          <div className="card-title">실시간 탐지 추이</div>
          <PerformanceChart snapshots={snapshots} total={progress.total} />
        </div>

        <div className="card">
          <div className="card-title">실시간 Findings ({findings.length})</div>
          <div className="dtest-findings-log" ref={logRef}>
            {findings.length === 0 ? (
              <p className="dtest-findings-log__empty">아직 발견된 이상 없음...</p>
            ) : (
              findings.map((f) => (
                <div key={f.id} className="dtest-finding-row animate-fade-in">
                  <SeverityBadge severity={f.severity} size="sm" />
                  <span className="dtest-finding-row__type">
                    {FINDING_TYPE_ICON[f.type]}
                    {FINDING_TYPE_LABEL[f.type]}
                  </span>
                  <code className="dtest-finding-row__input">{f.input}</code>
                  <span className="dtest-finding-row__desc">{f.description}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Results View ──

interface ResultsViewProps {
  result: DynamicTestResult;
  onNewTest: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ result, onNewTest }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="page-enter">
      <BackButton onClick={onNewTest} label="세션 목록으로" />
      <PageHeader title="테스트 결과" icon={<FlaskConical size={20} />} />

      {/* Summary */}
      <div className="stat-cards stagger">
        <StatCard icon={<Play size={16} />} label="총 실행" value={result.totalRuns} accent />
        <StatCard icon={<Bug size={16} />} label="Crashes" value={result.crashes} color="var(--danger)" />
        <StatCard icon={<AlertTriangle size={16} />} label="Anomalies" value={result.anomalies} color="var(--severity-medium)" />
        <StatCard icon={<Clock size={16} />} label="Findings" value={result.findings.length} accent />
      </div>

      {/* Config info */}
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

      {/* Findings list */}
      {result.findings.length > 0 ? (
        <div className="card">
          <div className="card-title">Findings ({result.findings.length})</div>
          {result.findings.map((f) => (
            <div key={f.id} className="dtest-finding-card" onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}>
              <div className="dtest-finding-card__header">
                <SeverityBadge severity={f.severity} size="sm" />
                <span className="dtest-finding-card__type">
                  {FINDING_TYPE_ICON[f.type]}
                  {FINDING_TYPE_LABEL[f.type]}
                </span>
                <span className="dtest-finding-card__desc">{f.description}</span>
                {f.llmAnalysis && (
                  expandedId === f.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                )}
              </div>
              <div className="dtest-finding-card__io">
                <div className="dtest-finding-card__io-row">
                  <span className="dtest-finding-card__io-label">Input</span>
                  <code>{f.input}</code>
                </div>
                {f.response && (
                  <div className="dtest-finding-card__io-row">
                    <span className="dtest-finding-card__io-label">Response</span>
                    <code>{f.response}</code>
                  </div>
                )}
              </div>
              {f.llmAnalysis && expandedId === f.id && (
                <div className="dtest-finding-card__llm animate-fade-in">
                  <span className="dtest-finding-card__llm-title">LLM 분석</span>
                  <p>{f.llmAnalysis}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <p style={{ color: "var(--text-tertiary)", margin: 0 }}>발견된 이상이 없습니다</p>
        </div>
      )}
    </div>
  );
};
