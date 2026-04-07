import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Settings, Plus, Trash2, FolderOpen, CheckCircle, XCircle, Loader, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import type { GateProfile } from "@aegis/shared";
import { fetchGateProfiles } from "../api/gate";
import { fetchProjectSettings, updateProjectSettings } from "../api/projects";
import type { RegisteredSdk, SdkRegistryStatus, SdkAnalyzedProfile } from "../api/sdk";
import { fetchProjectSdks, registerSdkByPath, deleteSdk, getSdkWsUrl } from "../api/sdk";
import { logError } from "../api/core";
import { useToast } from "../contexts/ToastContext";
import { createSeqTracker, parseWsMessage } from "../utils/wsEnvelope";
import { PageHeader, Spinner, EmptyState, ConfirmDialog } from "../components/ui";
import "./SdkManagementPage.css";
import "./SettingsPage.css";

const STATUS_CONFIG: Record<SdkRegistryStatus, { label: string; icon: "spin" | "check" | "fail" }> = {
  uploading: { label: "업로드 중", icon: "spin" },
  extracting: { label: "압축 해제 중", icon: "spin" },
  analyzing: { label: "AI 분석 중", icon: "spin" },
  verifying: { label: "검증 중", icon: "spin" },
  ready: { label: "사용 가능", icon: "check" },
  verify_failed: { label: "검증 실패", icon: "fail" },
};

const STEPS: SdkRegistryStatus[] = ["uploading", "extracting", "analyzing", "verifying", "ready"];
const STEP_LABELS = ["업로드", "압축해제", "AI 분석", "검증", "완료"];

function SdkStatusBadge({ status }: { status: SdkRegistryStatus }) {
  const config = STATUS_CONFIG[status];
  const icon = config.icon === "spin" ? <Loader size={12} className="animate-spin" />
    : config.icon === "check" ? <CheckCircle size={12} />
    : <XCircle size={12} />;
  const color = config.icon === "check" ? "var(--success)" : config.icon === "fail" ? "var(--danger)" : "var(--severity-medium)";
  return (
    <span className="sdk-status-badge" style={{ color }}>
      {icon} {config.label}
    </span>
  );
}

function SdkStepper({ status }: { status: SdkRegistryStatus }) {
  const currentIdx = STEPS.indexOf(status);
  if (status === "verify_failed") {
    return (
      <div className="sdk-stepper">
        {STEP_LABELS.map((label, i) => {
          const done = i < 3;
          const failed = i === 3;
          return (
            <React.Fragment key={label}>
              {i > 0 && <span className={`sdk-stepper__line${done ? " sdk-stepper__line--done" : ""}`} />}
              <span className={`sdk-stepper__step${done ? " sdk-stepper__step--done" : failed ? " sdk-stepper__step--failed" : ""}`}>
                {label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  }
  return (
    <div className="sdk-stepper">
      {STEP_LABELS.map((label, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={label}>
            {i > 0 && <span className={`sdk-stepper__line${done ? " sdk-stepper__line--done" : ""}`} />}
            <span className={`sdk-stepper__step${done ? " sdk-stepper__step--done" : active ? " sdk-stepper__step--active" : ""}`}>
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ProfileDetail({ profile }: { profile: SdkAnalyzedProfile }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sdk-profile-detail">
      <button className="sdk-profile-detail__toggle" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        분석된 프로파일
      </button>
      {open && (
        <div className="sdk-profile-detail__body">
          {profile.compiler && <div><strong>컴파일러:</strong> {profile.compiler}</div>}
          {profile.gccVersion && <div><strong>GCC 버전:</strong> {profile.gccVersion}</div>}
          {profile.targetArch && <div><strong>아키텍처:</strong> {profile.targetArch}</div>}
          {profile.languageStandard && <div><strong>언어 표준:</strong> {profile.languageStandard}</div>}
          {profile.sysroot && <div><strong>Sysroot:</strong> <code>{profile.sysroot}</code></div>}
          {profile.environmentSetup && <div><strong>환경 스크립트:</strong> <code>{profile.environmentSetup}</code></div>}
          {profile.includePaths && profile.includePaths.length > 0 && (
            <div><strong>Include paths:</strong> {profile.includePaths.map((p) => <code key={p}>{p}</code>)}</div>
          )}
        </div>
      )}
    </div>
  );
}

export const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();
  const [registered, setRegistered] = useState<RegisteredSdk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPath, setFormPath] = useState("");
  const [registering, setRegistering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RegisteredSdk | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [gateProfiles, setGateProfiles] = useState<GateProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [savingProfile, setSavingProfile] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchProjectSdks(projectId);
      setRegistered(data.registered);
    } catch (e) {
      logError("Load SDKs", e);
      toast.error("SDK 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!projectId) return;
    fetchGateProfiles()
      .then(setGateProfiles)
      .catch((e) => logError("GateProfiles.load", e));
    fetchProjectSettings(projectId)
      .then((s) => { if (s.gateProfileId) setSelectedProfileId(s.gateProfileId); })
      .catch((e) => logError("Settings.load", e));
  }, [projectId]);

  // WS for real-time SDK progress
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const ws = new WebSocket(getSdkWsUrl(projectId));
    wsRef.current = ws;
    const seqTracker = createSeqTracker("sdk");

    ws.onmessage = (evt) => {
      if (cancelled) return;
      try {
        const parsed = parseWsMessage(evt.data);
        seqTracker.check(parsed.meta);
        const { type, payload } = parsed;
        if (type === "sdk-progress") {
          setRegistered((prev) => prev.map((sdk) =>
            sdk.id === payload.sdkId ? { ...sdk, status: payload.phase as SdkRegistryStatus } : sdk,
          ));
        } else if (type === "sdk-complete") {
          setRegistered((prev) => prev.map((sdk) =>
            sdk.id === payload.sdkId ? { ...sdk, status: "ready" as SdkRegistryStatus, profile: payload.profile } : sdk,
          ));
          toast.success("SDK 등록 완료");
        } else if (type === "sdk-error") {
          setRegistered((prev) => prev.map((sdk) =>
            sdk.id === payload.sdkId ? { ...sdk, status: "verify_failed" as SdkRegistryStatus, verifyError: payload.error } : sdk,
          ));
          toast.error(`SDK 등록 실패: ${payload.error}`);
        }
      } catch (e) {
        console.warn("[WS:sdk] malformed message:", e);
      }
    };
    ws.onerror = () => {
      if (cancelled) return;
      console.warn("[WS:sdk] connection error");
    };
    ws.onclose = () => {
      if (!cancelled && wsRef.current === ws) wsRef.current = null;
    };

    return () => {
      cancelled = true;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [projectId, toast]);

  const handleRegister = useCallback(async () => {
    if (!projectId || !formName.trim()) { toast.error("SDK 이름을 입력해주세요."); return; }
    setRegistering(true);
    try {
      if (!formPath.trim()) { toast.error("경로를 입력해주세요."); setRegistering(false); return; }
      const sdk = await registerSdkByPath(
        projectId,
        formName.trim(),
        formPath.trim(),
        formDesc.trim() || undefined,
      );
      setRegistered((prev) => [...prev, sdk]);
      toast.success("SDK 등록 요청 완료 — 진행률을 확인하세요.");
      setShowForm(false);
      setFormName(""); setFormDesc(""); setFormPath("");
    } catch (e) {
      logError("Register SDK", e);
      toast.error("SDK 등록에 실패했습니다.");
    } finally {
      setRegistering(false);
    }
  }, [projectId, formName, formDesc, formPath, toast]);

  const handleDelete = useCallback(async (sdk: RegisteredSdk) => {
    if (!projectId) return;
    try {
      await deleteSdk(projectId, sdk.id);
      setRegistered((prev) => prev.filter((s) => s.id !== sdk.id));
      toast.success(`SDK "${sdk.name}" 삭제 완료`);
    } catch (e) {
      logError("Delete SDK", e);
      toast.error("SDK 삭제에 실패했습니다.");
    }
    setDeleteTarget(null);
  }, [projectId, toast]);

  const handleProfileChange = async (profileId: string) => {
    if (!projectId) return;
    setSavingProfile(true);
    try {
      await updateProjectSettings(projectId, { gateProfileId: profileId });
      setSelectedProfileId(profileId);
      toast.success("Gate 프로파일이 변경되었습니다.");
    } catch (e) {
      logError("GateProfile.save", e);
      toast.error("프로파일 변경에 실패했습니다.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return <div className="page-enter centered-loader"><Spinner size={36} label="설정 로딩 중..." /></div>;
  }

  return (
    <div className="page-enter">
      <PageHeader title="프로젝트 설정" icon={<Settings size={20} />} />

      {/* Quality Gate Profile Section */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <ShieldCheck size={16} />
          Quality Gate 프로파일
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
          프로젝트에 적용할 Quality Gate 규칙 세트를 선택합니다.
        </p>
        {gateProfiles.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)" }}>프로파일을 불러오는 중...</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {gateProfiles.map((gp) => (
                <button
                  key={gp.id}
                  className={`btn ${selectedProfileId === gp.id ? "" : "btn-secondary"}`}
                  onClick={() => handleProfileChange(gp.id)}
                  disabled={savingProfile}
                  title={gp.description}
                  style={{ minWidth: 100 }}
                >
                  {gp.name}
                </button>
              ))}
            </div>
            {selectedProfileId && (() => {
              const profile = gateProfiles.find((gp) => gp.id === selectedProfileId);
              if (!profile) return null;
              return (
                <div style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", background: "var(--surface-inset)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-2)" }}>{profile.name} — {profile.description}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    {profile.rules.map((r) => (
                      <div key={r.ruleId} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                        <span style={{ color: r.enabled ? "var(--success)" : "var(--text-tertiary)" }}>
                          {r.enabled ? "\u2713" : "\u2014"}
                        </span>
                        <span>{r.ruleId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* SDK Management Section */}
      <div className="card gs-card">
        <div className="gs-card__header">
          <div className="gs-card__icon"><Settings size={18} /></div>
          <div>
            <div className="gs-card__title">SDK 관리</div>
            <div className="gs-card__desc">크로스 컴파일 SDK를 등록하여 서브프로젝트 분석에 사용합니다.</div>
          </div>
        </div>

        <div className="sdk-actions">
          <button className="btn btn-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> SDK 추가
          </button>
        </div>

        {/* Register form */}
        {showForm && (
          <div className="card sdk-register-form">
            <div className="sdk-register-form__modes">
              <button className="sdk-mode-btn active" type="button">
                <FolderOpen size={14} /> 로컬 경로
              </button>
            </div>
            <p className="sdk-register-form__hint">
              현재 백엔드 계약상 SDK 등록은 <code>localPath</code> 입력만 보장됩니다.
            </p>
            <div className="sdk-register-form__fields">
              <label className="form-field">
                <span className="form-label">SDK 이름</span>
                <input className="form-input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="예: TI AM335x SDK" autoFocus />
              </label>
              <label className="form-field">
                <span className="form-label">설명 (선택)</span>
                <input className="form-input" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="SDK에 대한 간략한 설명" />
              </label>
              <label className="form-field">
                <span className="form-label">로컬 경로</span>
                <input className="form-input font-mono" value={formPath} onChange={(e) => setFormPath(e.target.value)} placeholder="/path/to/sdk" spellCheck={false} />
              </label>
            </div>
            <div className="sdk-register-form__actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>취소</button>
              <button className="btn btn-sm" onClick={handleRegister} disabled={registering}>
                {registering ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        )}

        {/* Registered SDKs */}
        {registered.length === 0 ? (
          <EmptyState icon={<Settings size={28} />} title="등록된 SDK가 없습니다" description="SDK 추가 버튼으로 크로스 컴파일 SDK를 등록하세요." />
        ) : (
          <div className="sdk-list">
            {registered.map((sdk) => (
              <div key={sdk.id} className={`card sdk-card sdk-card--registered${sdk.status === "verify_failed" ? " sdk-card--failed" : sdk.status === "ready" ? " sdk-card--ready" : ""}`}>
                <div className="sdk-card__header">
                  <span className="sdk-card__name">{sdk.name}</span>
                  <SdkStatusBadge status={sdk.status} />
                  <button className="btn-icon btn-danger" title="삭제" onClick={() => setDeleteTarget(sdk)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {sdk.description && <p className="sdk-card__desc">{sdk.description}</p>}
                {sdk.path && <div className="sdk-card__path"><code>{sdk.path}</code></div>}
                {sdk.status !== "ready" && sdk.status !== "verify_failed" && <SdkStepper status={sdk.status} />}
                {sdk.verifyError && <div className="sdk-card__error">{sdk.verifyError}</div>}
                {sdk.profile && <ProfileDetail profile={sdk.profile} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="SDK 삭제"
        message={deleteTarget ? `"${deleteTarget.name}" SDK를 삭제하시겠습니까?` : ""}
        confirmLabel="삭제"
        danger
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
