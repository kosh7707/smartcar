import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Shield,
  Plus,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Settings,
  Plug,
  Unplug,
  Cpu,
  Check,
  X,
  Link,
} from "lucide-react";
import type { Rule, Adapter } from "@smartcar/shared";
import {
  fetchRules, createRule, updateRule, deleteRule,
  createAdapter, updateAdapter, deleteAdapter,
  connectAdapterById, disconnectAdapterById,
  fetchProjectSettings, updateProjectSettings,
} from "../api/client";
import { useAdapters } from "../hooks/useAdapters";
import { PageHeader, SeverityBadge, Spinner } from "../components/ui";
import { SEVERITY_ORDER } from "../utils/severity";
import "./SettingsPage.css";

type SettingsTab = "connections" | "rules";

interface RuleFormData {
  name: string;
  pattern: string;
  severity: string;
  description: string;
  suggestion: string;
  fixCode: string;
}

const EMPTY_FORM: RuleFormData = { name: "", pattern: "", severity: "medium", description: "", suggestion: "", fixCode: "" };

export const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<SettingsTab>("connections");

  // Rules
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // Adapters (shared store)
  const { adapters, refresh: refreshAdapters } = useAdapters(projectId);
  const [showAdapterForm, setShowAdapterForm] = useState(false);
  const [editingAdapterId, setEditingAdapterId] = useState<string | null>(null);
  const [adapterForm, setAdapterForm] = useState({ name: "", url: "ws://localhost:4000" });
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // LLM settings
  const [llmUrl, setLlmUrl] = useState("");
  const [llmSaved, setLlmSaved] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<"idle" | "ok" | "error">("idle");

  // ── Adapter handlers ──

  const handleAdapterSubmit = async () => {
    if (!projectId) return;
    if (!adapterForm.url.trim()) {
      setAdapterError("URL은 필수입니다.");
      return;
    }
    const name = adapterForm.name.trim() || `CAN Adapter #${adapters.length + 1}`;
    const req = { name, url: adapterForm.url.trim() };
    try {
      if (editingAdapterId) {
        await updateAdapter(projectId, editingAdapterId, req);
      } else {
        await createAdapter(projectId, req);
      }
      await refreshAdapters();
      setShowAdapterForm(false);
      setEditingAdapterId(null);
      setAdapterForm({ name: "", url: "ws://localhost:4000" });
      setAdapterError(null);
    } catch (e) {
      setAdapterError(e instanceof Error ? e.message : "저장 실패");
    }
  };

  const handleAdapterEdit = (a: Adapter) => {
    setEditingAdapterId(a.id);
    setAdapterForm({ name: a.name, url: a.url });
    setShowAdapterForm(true);
    setAdapterError(null);
  };

  const handleAdapterDelete = async (a: Adapter) => {
    if (!projectId) return;
    if (!confirm(`"${a.name}" 어댑터를 삭제하시겠습니까?`)) return;
    try {
      await deleteAdapter(projectId, a.id);
      await refreshAdapters();
    } catch (e) {
      console.error("Delete adapter failed:", e);
    }
  };

  const handleConnect = async (a: Adapter) => {
    if (!projectId) return;
    setConnectingId(a.id);
    try {
      await connectAdapterById(projectId, a.id);
      await refreshAdapters();
      setTimeout(() => refreshAdapters(), 1500);
    } catch (e) {
      setAdapterError(e instanceof Error ? e.message : "연결 실패");
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (a: Adapter) => {
    if (!projectId) return;
    try {
      await disconnectAdapterById(projectId, a.id);
      await refreshAdapters();
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  };

  const handleAdapterCancel = () => {
    setShowAdapterForm(false);
    setEditingAdapterId(null);
    setAdapterForm({ name: "", url: "ws://localhost:4000" });
    setAdapterError(null);
  };

  // ── Rule handlers ──

  const loadRules = async () => {
    if (!projectId) return;
    try {
      const data = await fetchRules(projectId);
      setRules(data);
    } catch (e) {
      console.error("Failed to fetch rules:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    if (!projectId) return;
    try {
      const s = await fetchProjectSettings(projectId);
      setLlmUrl(s.llmUrl);
    } catch {
      // default
    }
  };

  useEffect(() => { loadRules(); loadSettings(); }, [projectId]);

  const handleToggle = async (rule: Rule) => {
    if (!projectId) return;
    try {
      const updated = await updateRule(projectId, rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      console.error("Failed to toggle rule:", e);
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (!projectId) return;
    if (!confirm(`"${rule.name}" 룰을 삭제하시겠습니까?`)) return;
    try {
      await deleteRule(projectId, rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (e) {
      console.error("Failed to delete rule:", e);
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      pattern: rule.pattern,
      severity: rule.severity,
      description: rule.description,
      suggestion: rule.suggestion,
      fixCode: rule.fixCode ?? "",
    });
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!projectId) return;
    if (!form.name.trim() || !form.pattern.trim()) {
      setError("이름과 패턴은 필수입니다.");
      return;
    }
    try {
      if (editingId) {
        const updated = await updateRule(projectId, editingId, form);
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createRule(projectId, form);
        setRules((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  if (loading) {
    return (
      <div className="page-enter" style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-16)" }}>
        <Spinner label="설정 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader title="프로젝트 설정" icon={<Settings size={20} />} />

      {/* Tab navigation */}
      <div className="settings-tabs">
        <button
          className={`settings-tab${activeTab === "connections" ? " settings-tab--active" : ""}`}
          onClick={() => setActiveTab("connections")}
        >
          <Link size={14} />
          연결 관리
        </button>
        <button
          className={`settings-tab${activeTab === "rules" ? " settings-tab--active" : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          <Shield size={14} />
          룰 관리
        </button>
      </div>

      {/* ═══ Connections Tab ═══ */}
      {activeTab === "connections" && (
        <>
          {/* Adapter Management */}
          <div className="card">
            <div className="settings-rule-header">
              <div className="card-title" style={{ marginBottom: 0 }}>
                <Plug size={16} />
                Adapter
              </div>
              <button
                className="btn btn-sm"
                onClick={() => { setShowAdapterForm(true); setEditingAdapterId(null); setAdapterForm({ name: "", url: "ws://localhost:4000" }); setAdapterError(null); }}
              >
                <Plus size={14} />
                추가
              </button>
            </div>

            {showAdapterForm && (
              <div className="settings-rule-form">
                <div className="settings-rule-form__title">
                  {editingAdapterId ? "어댑터 수정" : "어댑터 추가"}
                </div>
                {adapterError && <div className="settings-rule-form__error">{adapterError}</div>}
                <div className="settings-rule-form__grid">
                  <label className="form-field">
                    <span className="form-label">이름 *</span>
                    <input
                      className="form-input"
                      value={adapterForm.name}
                      onChange={(e) => setAdapterForm({ ...adapterForm, name: e.target.value })}
                      placeholder="CAN Adapter #1"
                    />
                  </label>
                  <label className="form-field">
                    <span className="form-label">URL *</span>
                    <input
                      className="form-input"
                      value={adapterForm.url}
                      onChange={(e) => setAdapterForm({ ...adapterForm, url: e.target.value })}
                      placeholder="ws://localhost:4000"
                    />
                  </label>
                </div>
                <div className="settings-rule-form__actions">
                  <button className="btn btn-secondary btn-sm" onClick={handleAdapterCancel}>취소</button>
                  <button className="btn btn-sm" onClick={handleAdapterSubmit}>
                    {editingAdapterId ? "수정" : "추가"}
                  </button>
                </div>
              </div>
            )}

            {adapters.length === 0 ? (
              <p className="text-tertiary" style={{ fontSize: "var(--text-sm)" }}>등록된 어댑터가 없습니다. 어댑터를 추가해주세요.</p>
            ) : (
              adapters.map((a) => (
                <div key={a.id} className="adapter-row">
                  <span className={`status-dot ${a.connected ? (a.ecuConnected ? "ok" : "warning") : "error"}`} />
                  <div className="adapter-row__body">
                    <div className="adapter-row__name">{a.name}</div>
                    <div className="adapter-row__meta">
                      <code className="adapter-url">{a.url}</code>
                      {a.connected && (
                        <span className="adapter-row__ecu">
                          {a.ecuConnected ? "ECU 연결됨" : "ECU 대기"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="adapter-row__actions">
                    {a.connected ? (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleDisconnect(a)}>
                        <Unplug size={14} />
                        해제
                      </button>
                    ) : (
                      <button className="btn btn-sm" onClick={() => handleConnect(a)} disabled={connectingId === a.id}>
                        {connectingId === a.id ? <Spinner size={14} /> : <Plug size={14} />}
                        연결
                      </button>
                    )}
                    <button className="btn-icon" title="수정" onClick={() => handleAdapterEdit(a)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon btn-danger" title="삭제" onClick={() => handleAdapterDelete(a)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* LLM Connection */}
          <div className="card gs-card">
            <div className="gs-card__header">
              <div className="gs-card__icon"><Cpu size={18} /></div>
              <div>
                <div className="gs-card__title">LLM Gateway</div>
                <div className="gs-card__desc">이 프로젝트에서 사용할 LLM Gateway 주소를 설정합니다. 비워두면 서버 기본값을 사용합니다.</div>
              </div>
            </div>

            <div className="gs-url-row">
              <div className="gs-url-input-wrap">
                <input
                  type="text"
                  className="form-input gs-url-input"
                  value={llmUrl}
                  onChange={(e) => { setLlmUrl(e.target.value); setLlmTestResult("idle"); }}
                  placeholder="http://localhost:8000"
                  spellCheck={false}
                />
                {llmTestResult === "ok" && <span className="gs-url-badge gs-url-badge--ok"><Check size={12} /></span>}
                {llmTestResult === "error" && <span className="gs-url-badge gs-url-badge--error"><X size={12} /></span>}
                {llmTesting && <span className="gs-url-badge gs-url-badge--testing"><Spinner size={12} /></span>}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  setLlmTesting(true);
                  setLlmTestResult("idle");
                  try {
                    const res = await fetch(`${llmUrl.trim() || "http://localhost:8000"}/health`);
                    const data = await res.json();
                    setLlmTestResult(data?.status === "ok" ? "ok" : "error");
                  } catch {
                    setLlmTestResult("error");
                  } finally {
                    setLlmTesting(false);
                  }
                }}
                disabled={llmTesting}
              >
                테스트
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  if (!projectId) return;
                  try {
                    const updated = await updateProjectSettings(projectId, { llmUrl });
                    setLlmUrl(updated.llmUrl);
                    setLlmSaved(true);
                    setTimeout(() => setLlmSaved(false), 2000);
                  } catch { /* ignore */ }
                }}
              >
                {llmSaved ? "저장됨" : "저장"}
              </button>
            </div>

            {llmTestResult !== "idle" && !llmTesting && (
              <div className={`gs-test-msg gs-test-msg--${llmTestResult}`}>
                {llmTestResult === "ok" ? "LLM Gateway 연결 성공" : "LLM Gateway 연결 실패"}
              </div>
            )}

            <button
              className="gs-reset-link"
              onClick={async () => {
                if (!projectId) return;
                try {
                  const updated = await updateProjectSettings(projectId, { llmUrl: "" });
                  setLlmUrl(updated.llmUrl);
                  setLlmTestResult("idle");
                } catch { /* ignore */ }
              }}
            >
              서버 기본값으로 초기화
            </button>
          </div>
        </>
      )}

      {/* ═══ Rules Tab ═══ */}
      {activeTab === "rules" && (
        <div className="card">
          <div className="settings-rule-header">
            <div className="card-title" style={{ marginBottom: 0 }}>
              <Shield size={16} />
              룰 관리
            </div>
            <button
              className="btn btn-sm"
              onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); setError(null); }}
            >
              <Plus size={14} />
              룰 추가
            </button>
          </div>

          {showForm && (
            <div className="settings-rule-form">
              <div className="settings-rule-form__title">
                {editingId ? "룰 수정" : "룰 생성"}
              </div>
              {error && <div className="settings-rule-form__error">{error}</div>}
              <div className="settings-rule-form__grid">
                <label className="form-field">
                  <span className="form-label">이름 *</span>
                  <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="룰 이름" />
                </label>
                <label className="form-field">
                  <span className="form-label">심각도</span>
                  <select className="form-input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                    {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label className="form-field" style={{ marginTop: "var(--space-3)" }}>
                <span className="form-label">정규식 패턴 *</span>
                <input className="form-input font-mono" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} placeholder="\bgets\s*\(" />
              </label>
              <label className="form-field" style={{ marginTop: "var(--space-3)" }}>
                <span className="form-label">설명</span>
                <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="이 룰이 탐지하는 취약점 설명" />
              </label>
              <div className="settings-rule-form__grid" style={{ marginTop: "var(--space-3)" }}>
                <label className="form-field">
                  <span className="form-label">수정 제안</span>
                  <input className="form-input" value={form.suggestion} onChange={(e) => setForm({ ...form, suggestion: e.target.value })} placeholder="권장 수정 방법" />
                </label>
                <label className="form-field">
                  <span className="form-label">수정 코드</span>
                  <input className="form-input font-mono" value={form.fixCode} onChange={(e) => setForm({ ...form, fixCode: e.target.value })} placeholder="대체 코드 예시" />
                </label>
              </div>
              <div className="settings-rule-form__actions">
                <button className="btn btn-secondary btn-sm" onClick={handleCancel}>취소</button>
                <button className="btn btn-sm" onClick={handleSubmit}>{editingId ? "수정" : "생성"}</button>
              </div>
            </div>
          )}

          {rules.length > 0 ? (
            rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
            ))
          ) : (
            <p className="text-tertiary">등록된 룰이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
};

function RuleRow({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: Rule;
  onToggle: (r: Rule) => void;
  onEdit: (r: Rule) => void;
  onDelete: (r: Rule) => void;
}) {
  return (
    <div className="rule-row">
      <button
        onClick={() => onToggle(rule)}
        className={`rule-row__toggle${rule.enabled ? " rule-row__toggle--enabled" : ""}`}
        title={rule.enabled ? "비활성화" : "활성화"}
      >
        {rule.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
      <div className={`rule-row__body${!rule.enabled ? " rule-row__body--disabled" : ""}`}>
        <div className="rule-row__name">
          <span className="rule-row__name-text">{rule.name}</span>
          <SeverityBadge severity={rule.severity} size="sm" />
        </div>
        <div className="rule-row__desc">
          {rule.description}
          {rule.pattern && <span className="rule-row__pattern">{rule.pattern}</span>}
        </div>
      </div>
      <div className="rule-row__actions">
        <button onClick={() => onEdit(rule)} className="btn-icon" title="수정">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(rule)} className="btn-icon btn-danger" title="삭제">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
