import { apiFetch, getWsBaseUrl } from "./core";

/* ── Types ── */

export type SdkRegistryStatus =
  | "uploading"
  | "extracting"
  | "analyzing"
  | "verifying"
  | "ready"
  | "verify_failed";

export interface SdkAnalyzedProfile {
  compiler?: string;
  compilerPrefix?: string;
  gccVersion?: string;
  targetArch?: string;
  languageStandard?: string;
  sysroot?: string;
  envSetupScript?: string;
  includePaths?: string[];
  defines?: Record<string, string>;
}

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

export interface RegisteredSdk {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  path: string;
  profile?: SdkAnalyzedProfile;
  status: SdkRegistryStatus;
  verifyError?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
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

export async function registerSdkByPath(
  projectId: string,
  name: string,
  localPath: string,
  description?: string,
): Promise<{ sdkId: string }> {
  const res = await apiFetch<{ success: boolean; data: { sdkId: string } }>(
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
  file: File,
  description?: string,
): Promise<{ sdkId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  if (description) formData.append("description", description);
  const res = await apiFetch<{ success: boolean; data: { sdkId: string } }>(
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
