import type { ProjectSettings, BuildProfile } from "@aegis/shared";
import type { IProjectSettingsDAO } from "../dao/interfaces";
import { findSdkProfile } from "./sdk-profiles";

const DEFAULT_BUILD_PROFILE: BuildProfile = {
  sdkId: "custom",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c11",
  headerLanguage: "auto",
};

const SCALAR_DEFAULTS: Omit<ProjectSettings, "buildProfile"> = {
  llmUrl: process.env.LLM_GATEWAY_URL ?? "http://localhost:8000",
};

/** KV 스토어에서 JSON 직렬화가 필요한 키 */
const JSON_KEYS = new Set<string>(["buildProfile"]);

/** 인식하는 모든 설정 키 */
const KNOWN_KEYS = new Set<string>([
  ...Object.keys(SCALAR_DEFAULTS),
  ...JSON_KEYS,
]);

export class ProjectSettingsService {
  constructor(private projectSettingsDAO: IProjectSettingsDAO) {}

  getAll(projectId: string): ProjectSettings {
    const overrides = this.projectSettingsDAO.getAll(projectId);
    const result: ProjectSettings = { ...SCALAR_DEFAULTS };

    for (const [key, value] of Object.entries(overrides)) {
      if (!KNOWN_KEYS.has(key)) continue;
      if (JSON_KEYS.has(key)) {
        try {
          (result as any)[key] = JSON.parse(value);
        } catch {
          // 파싱 실패 시 무시
        }
      } else {
        (result as any)[key] = value;
      }
    }

    // buildProfile이 없으면 기본값
    if (!result.buildProfile) {
      result.buildProfile = { ...DEFAULT_BUILD_PROFILE };
    }

    return result;
  }

  get<K extends keyof ProjectSettings>(projectId: string, key: K): ProjectSettings[K] {
    const val = this.projectSettingsDAO.get(projectId, key as string);
    if (val === undefined) {
      if (key === "buildProfile") return { ...DEFAULT_BUILD_PROFILE } as ProjectSettings[K];
      return (SCALAR_DEFAULTS as any)[key] as ProjectSettings[K];
    }
    if (JSON_KEYS.has(key as string)) {
      try {
        return JSON.parse(val) as ProjectSettings[K];
      } catch {
        if (key === "buildProfile") return { ...DEFAULT_BUILD_PROFILE } as ProjectSettings[K];
        return (SCALAR_DEFAULTS as any)[key] as ProjectSettings[K];
      }
    }
    return val as ProjectSettings[K];
  }

  update(projectId: string, partial: Partial<ProjectSettings>): ProjectSettings {
    for (const [key, value] of Object.entries(partial)) {
      if (!KNOWN_KEYS.has(key)) continue;
      if (value === undefined || value === null) {
        this.projectSettingsDAO.deleteKey(projectId, key);
      } else if (JSON_KEYS.has(key)) {
        // buildProfile: SDK defaults 병합 후 저장
        const resolved = key === "buildProfile"
          ? this.resolveBuildProfile(value as Partial<BuildProfile>)
          : value;
        this.projectSettingsDAO.set(projectId, key, JSON.stringify(resolved));
      } else if (value === "") {
        this.projectSettingsDAO.deleteKey(projectId, key);
      } else {
        this.projectSettingsDAO.set(projectId, key, String(value));
      }
    }
    return this.getAll(projectId);
  }

  deleteByProjectId(projectId: string): void {
    this.projectSettingsDAO.deleteByProjectId(projectId);
  }

  getDefaults(): ProjectSettings {
    return { ...SCALAR_DEFAULTS, buildProfile: { ...DEFAULT_BUILD_PROFILE } };
  }

  /**
   * SDK 프로파일 defaults를 병합하여 완전한 BuildProfile을 반환한다.
   * 사용자가 개별 필드를 override하면 그 값이 우선한다.
   */
  resolveBuildProfile(partial: Partial<BuildProfile>): BuildProfile {
    const sdkId = partial.sdkId ?? "custom";
    const sdkProfile = findSdkProfile(sdkId);
    const sdkDefaults = sdkProfile?.defaults ?? DEFAULT_BUILD_PROFILE;

    return {
      sdkId,
      compiler: partial.compiler ?? sdkDefaults.compiler,
      compilerVersion: partial.compilerVersion ?? sdkDefaults.compilerVersion,
      targetArch: partial.targetArch ?? sdkDefaults.targetArch,
      languageStandard: partial.languageStandard ?? sdkDefaults.languageStandard,
      headerLanguage: partial.headerLanguage ?? sdkDefaults.headerLanguage,
      includePaths: partial.includePaths ?? sdkDefaults.includePaths,
      defines: partial.defines ?? sdkDefaults.defines,
      flags: partial.flags ?? sdkDefaults.flags,
    };
  }
}
