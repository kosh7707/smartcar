import { apiFetch, getBaseUrl, getWsBaseUrl } from "./core";
import type {
  SdkRegistryStatus as _SdkRegistryStatus,
  SdkArtifactKind as _SdkArtifactKind,
  SdkAnalyzedProfile as _SdkAnalyzedProfile,
  RegisteredSdk as _RegisteredSdk,
  SdkErrorCode as _SdkErrorCode,
  SdkErrorPhase as _SdkErrorPhase,
  SdkPhaseDetail as _SdkPhaseDetail,
  SdkProgressPhase as _SdkProgressPhase,
  SdkPhaseHistoryEntry as _SdkPhaseHistoryEntry,
} from "@aegis/shared";

/* ── Re-exported shared types ── */

export type SdkRegistryStatus = _SdkRegistryStatus;
export type SdkArtifactKind = _SdkArtifactKind;
export type SdkAnalyzedProfile = _SdkAnalyzedProfile;
export type RegisteredSdk = _RegisteredSdk;
export type SdkErrorCode = _SdkErrorCode;
export type SdkErrorPhase = _SdkErrorPhase;
export type SdkPhaseDetail = _SdkPhaseDetail;
export type SdkProgressPhase = _SdkProgressPhase;
export type SdkPhaseHistoryEntry = _SdkPhaseHistoryEntry;

/* ── SDK quota / retry / log response shapes ── */

export interface SdkQuota {
  usedBytes: number;
  maxBytes: number;
  sdkCount: number;
}

export interface SdkLogResponse {
  sdkId: string;
  logPath?: string;
  content: string;
  truncated: boolean;
  totalLines?: number;
  nextOffset?: number;
}

export type SdkRetryFromPhase = "analyzing" | "verifying";

/* ── Local types (NOT migrated — SdkProfile.defaults shape differs from shared) ── */

export interface SdkProfile {
  id: string;
  name: string;
  vendor: string;
  description: string;
  defaults: {
    compiler: string;
    targetArch: string;
    languageStandard: string;
    headerLanguage: string;
    includePaths?: string[];
    defines?: Record<string, string>;
  };
}

export interface SdkListResponse {
  builtIn: SdkProfile[];
  registered: RegisteredSdk[];
}

/* ── API ── */

export async function fetchProjectSdks(projectId: string): Promise<SdkListResponse> {
  const res = await apiFetch<{ success: boolean; data: SdkListResponse }>(
    `/api/projects/${projectId}/sdk`,
  );
  return res.data;
}

export async function fetchSdkDetail(projectId: string, sdkId: string): Promise<RegisteredSdk> {
  const res = await apiFetch<{ success: boolean; data: RegisteredSdk }>(
    `/api/projects/${projectId}/sdk/${sdkId}`,
  );
  return res.data;
}

/** @deprecated Use registerSdkByUpload instead. Will be removed after S2 confirms localPath removal. */
export async function registerSdkByPath(
  projectId: string,
  name: string,
  localPath: string,
  description?: string,
): Promise<RegisteredSdk> {
  const res = await apiFetch<{ success: boolean; data: RegisteredSdk }>(
    `/api/projects/${projectId}/sdk`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, localPath, description }),
    },
  );
  return res.data;
}

export async function registerSdkByUpload(
  projectId: string,
  name: string,
  files: File[],
  description?: string,
  relativePaths?: string[],
): Promise<RegisteredSdk> {
  const formData = new FormData();
  formData.append("name", name);
  if (description) formData.append("description", description);
  if (relativePaths && relativePaths.length > 0) {
    for (let i = 0; i < files.length; i++) {
      formData.append("relativePath", relativePaths[i]);
      formData.append("file", files[i]);
    }
  } else {
    for (const f of files) formData.append("file", f);
  }
  const res = await apiFetch<{ success: boolean; data: RegisteredSdk }>(
    `/api/projects/${projectId}/sdk`,
    { method: "POST", body: formData },
  );
  return res.data;
}

export async function deleteSdk(projectId: string, sdkId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/sdk/${sdkId}`, { method: "DELETE" });
}

export function getSdkWsUrl(projectId: string): string {
  return `${getWsBaseUrl()}/ws/sdk?projectId=${encodeURIComponent(projectId)}`;
}

/* ── Retry / Log / Quota (S2 SDK second follow-up runtime surfaces) ── */

export async function retrySdk(
  projectId: string,
  sdkId: string,
  opts?: { fromPhase?: SdkRetryFromPhase },
): Promise<RegisteredSdk> {
  const init: RequestInit = { method: "POST" };
  if (opts?.fromPhase) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify({ fromPhase: opts.fromPhase });
  }
  const res = await apiFetch<{ success: boolean; data: RegisteredSdk }>(
    `/api/projects/${projectId}/sdk/${sdkId}/retry`,
    init,
  );
  return res.data;
}

export async function fetchSdkLog(
  projectId: string,
  sdkId: string,
  opts?: { tailLines?: number; offset?: number; limit?: number },
): Promise<SdkLogResponse> {
  const params = new URLSearchParams();
  if (opts?.tailLines != null) params.set("tailLines", String(opts.tailLines));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const path = `/api/projects/${projectId}/sdk/${sdkId}/log${qs ? `?${qs}` : ""}`;
  const res = await apiFetch<{ success: boolean; data: SdkLogResponse }>(path);
  return res.data;
}

export function getSdkLogDownloadUrl(projectId: string, sdkId: string): string {
  return `${getBaseUrl()}/api/projects/${projectId}/sdk/${sdkId}/log?download=true`;
}

export async function fetchSdkQuota(projectId: string): Promise<SdkQuota> {
  const res = await apiFetch<{ success: boolean; data: SdkQuota }>(
    `/api/projects/${projectId}/sdk/quota`,
  );
  return res.data;
}
