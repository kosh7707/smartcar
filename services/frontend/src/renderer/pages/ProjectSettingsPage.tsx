import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Settings, Plus, Trash2, CheckCircle, XCircle, Loader, ChevronDown, ChevronRight, ShieldCheck, Archive, Binary, FolderOpen } from "lucide-react";
import type { GateProfile } from "@aegis/shared";
import { fetchGateProfiles } from "../api/gate";
import { fetchProjectSettings, updateProjectSettings } from "../api/projects";
import type { RegisteredSdk, SdkRegistryStatus, SdkAnalyzedProfile } from "../api/sdk";
import { fetchProjectSdks, deleteSdk } from "../api/sdk";
import { logError } from "../api/core";
import { useToast } from "../contexts/ToastContext";
import { useSdkProgress } from "../hooks/useSdkProgress";
import { PageHeader, Spinner, EmptyState, ConfirmDialog, ConnectionStatusBanner } from "../components/ui";
import { SdkUploadForm } from "../components/SdkUploadForm";
import "./SdkManagementPage.css";
import "./SettingsPage.css";

const STATUS_CONFIG: Record<SdkRegistryStatus, { label: string; icon: "spin" | "check" | "fail" }> = {
  uploading: { label: "업로드 중", icon: "spin" },
  uploaded: { label: "업로드 완료", icon: "spin" },
  extracting: { label: "압축 해제 중", icon: "spin" },
  extracted: { label: "압축 해제 완료", icon: "spin" },
  installing: { label: "설치 중", icon: "spin" },
  installed: { label: "설치 완료", icon: "spin" },
  analyzing: { label: "AI 분석 중", icon: "spin" },
  verifying: { label: "검증 중", icon: "spin" },
  ready: { label: "사용 가능", icon: "check" },
  upload_failed: { label: "업로드 실패", icon: "fail" },
  extract_failed: { label: "압축해제 실패", icon: "fail" },
  install_failed: { label: "설치 실패", icon: "fail" },
  verify_failed: { label: "검증 실패", icon: "fail" },
};

const PHASE_GROUPS: { label: string; phases: SdkRegistryStatus[]; failPhases: SdkRegistryStatus[] }[] = [
  { label: "업로드", phases: ["uploading", "uploaded"], failPhases: ["upload_failed"] },
  { label: "설치/압축해제", phases: ["extracting", "extracted", "installing", "installed"], failPhases: ["extract_failed", "install_failed"] },
  { label: "AI 분석", phases: ["analyzing"], failPhases: [] },
  { label: "검증", phases: ["verifying"], failPhases: ["verify_failed"] },
  { label: "완료", phases: ["ready"], failPhases: [] },
];

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
  // Find which group the current status belongs to
  let activeGroupIdx = -1;
  let failedGroupIdx = -1;
  for (let g = 0; g < PHASE_GROUPS.length; g++) {
    if (PHASE_GROUPS[g].phases.includes(status)) activeGroupIdx = g;
    if (PHASE_GROUPS[g].failPhases.includes(status)) failedGroupIdx = g;
  }

  return (
    <div className="sdk-stepper">
      {PHASE_GROUPS.map((group, i) => {
        const failed = failedGroupIdx === i;
        const done = failedGroupIdx >= 0 ? i < failedGroupIdx : activeGroupIdx >= 0 ? i < activeGroupIdx : false;
        const active = !failed && activeGroupIdx === i;
        const cls = failed ? " sdk-stepper__step--failed"
          : done ? " sdk-stepper__step--done"
          : active ? " sdk-stepper__step--active"
          : "";
        return (
          <React.Fragment key={group.label}>
            {i > 0 && <span className={`sdk-stepper__line${done ? " sdk-stepper__line--done" : ""}`} />}
            <span className={`sdk-stepper__step${cls}`}>{group.label}</span>
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
  const [deleteTarget, setDeleteTarget] = useState<RegisteredSdk | null>(null);
  const { connectionState: sdkConnectionState } = useSdkProgress({
    projectId,
    onProgress: useCallback((sdkId: string, phase: SdkRegistryStatus) => {
      setRegistered((prev) => prev.map((sdk) =>
        sdk.id === sdkId ? { ...sdk, status: phase } : sdk,
      ));
    }, []),
    onComplete: useCallback((sdkId: string, profile: RegisteredSdk["profile"]) => {
      setRegistered((prev) => prev.map((sdk) =>
        sdk.id === sdkId ? { ...sdk, status: "ready" as SdkRegistryStatus, profile } : sdk,
      ));
      toast.success("SDK 등록 완료");
    }, [toast]),
    onError: useCallback((sdkId: string, error: string, phase?: string, logPath?: string) => {
      const errorStatus = (phase || "verify_failed") as SdkRegistryStatus;
      const ERROR_LABELS: Record<string, string> = {
        upload_failed: "업로드 실패",
        extract_failed: "압축해제 실패",
        install_failed: "설치 실패",
        verify_failed: "검증 실패",
      };
      setRegistered((prev) => prev.map((sdk) =>
        sdk.id === sdkId ? { ...sdk, status: errorStatus, verifyError: error, installLogPath: logPath } : sdk,
      ));
      toast.error(`SDK ${ERROR_LABELS[errorStatus] ?? "등록 실패"}: ${error}`);
    }, [toast]),
  });
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

  // SDK WS progress is now handled by useSdkProgress hook above

  const handleRegistered = useCallback((sdk: RegisteredSdk) => {
    setRegistered((prev) => [...prev, sdk]);
    setShowForm(false);
  }, []);

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
      <ConnectionStatusBanner connectionState={sdkConnectionState} />
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
        {showForm && projectId && (
          <SdkUploadForm
            projectId={projectId}
            onRegistered={handleRegistered}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Registered SDKs */}
        {registered.length === 0 ? (
          <EmptyState icon={<Settings size={28} />} title="등록된 SDK가 없습니다" description="SDK 추가 버튼으로 크로스 컴파일 SDK를 등록하세요." />
        ) : (
          <div className="sdk-list">
            {registered.map((sdk) => (
              <div key={sdk.id} className={`card sdk-card sdk-card--registered${sdk.status.endsWith("_failed") ? " sdk-card--failed" : sdk.status === "ready" ? " sdk-card--ready" : ""}`}>
                <div className="sdk-card__header">
                  <span className="sdk-card__name">{sdk.name}</span>
                  {sdk.artifactKind && (
                    <span className="sdk-card__kind">
                      {sdk.artifactKind === "archive" ? <Archive size={12} /> : sdk.artifactKind === "bin" ? <Binary size={12} /> : <FolderOpen size={12} />}
                      {sdk.artifactKind === "archive" ? "아카이브" : sdk.artifactKind === "bin" ? "바이너리" : "폴더"}
                    </span>
                  )}
                  <SdkStatusBadge status={sdk.status} />
                  <button className="btn-icon btn-danger" title="삭제" onClick={() => setDeleteTarget(sdk)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {sdk.description && <p className="sdk-card__desc">{sdk.description}</p>}
                {(sdk.sdkVersion || sdk.targetSystem) && (
                  <div className="sdk-card__meta">
                    {sdk.sdkVersion && <span>버전: <code>{sdk.sdkVersion}</code></span>}
                    {sdk.targetSystem && <span>타겟: <code>{sdk.targetSystem}</code></span>}
                  </div>
                )}
                {sdk.path && <div className="sdk-card__path"><code>{sdk.path}</code></div>}
                {sdk.status !== "ready" && !sdk.status.endsWith("_failed") && <SdkStepper status={sdk.status} />}
                {sdk.verifyError && <div className="sdk-card__error">{sdk.verifyError}</div>}
                {sdk.status.endsWith("_failed") && sdk.installLogPath && (
                  <div className="sdk-card__logpath"><strong>로그 경로:</strong> <code>{sdk.installLogPath}</code></div>
                )}
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
