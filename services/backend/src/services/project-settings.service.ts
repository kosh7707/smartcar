import type { ProjectSettings, BuildProfile, RegisteredSdk } from "@aegis/shared";
import type { IProjectSettingsDAO } from "../dao/interfaces";
import { findSdkProfile } from "./sdk-profiles";
import { config } from "../config";
import { createLogger } from "../lib/logger";

const logger = createLogger("project-settings");

/** SdkRegistryDAO의 조회만 필요 — 전체 인터페이스 의존 회피 */
export interface ISdkRegistryLookup {
  findById(id: string): RegisteredSdk | undefined;
}

const DEFAULT_BUILD_PROFILE: BuildProfile = {
  sdkId: "custom",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c11",
  headerLanguage: "auto",
};

/** SDK를 사용하지 않는 프로젝트를 위한 최소 프로파일 */
const NONE_BUILD_PROFILE: BuildProfile = {
  sdkId: "none",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c11",
  headerLanguage: "auto",
};

const SCALAR_DEFAULTS: Omit<ProjectSettings, "buildProfile"> = {
  llmUrl: config.llmGatewayUrl,
};

/** KV 스토어에서 JSON 직렬화가 필요한 키 */
const JSON_KEYS = new Set<string>(["buildProfile"]);

/** 인식하는 모든 설정 키 */
const KNOWN_KEYS = new Set<string>([
  ...Object.keys(SCALAR_DEFAULTS),
  ...JSON_KEYS,
]);

export class ProjectSettingsService {
  constructor(
    private projectSettingsDAO: IProjectSettingsDAO,
    private sdkRegistryLookup?: ISdkRegistryLookup,
  ) {}

  getAll(projectId: string): ProjectSettings {
    const overrides = this.projectSettingsDAO.getAll(projectId);
    const result = { ...SCALAR_DEFAULTS } as Record<string, unknown> & Partial<ProjectSettings>;

    for (const [key, value] of Object.entries(overrides)) {
      if (!KNOWN_KEYS.has(key)) continue;
      if (JSON_KEYS.has(key)) {
        try {
          result[key] = JSON.parse(value);
        } catch (err) {
          logger.warn({ projectId, key, err }, "JSON setting parse failed");
        }
      } else {
        result[key] = value;
      }
    }

    // buildProfile이 없으면 기본값
    if (!result.buildProfile) {
      result.buildProfile = { ...DEFAULT_BUILD_PROFILE };
    }

    return result as ProjectSettings;
  }

  get<K extends keyof ProjectSettings>(projectId: string, key: K): ProjectSettings[K] {
    const defaults: Record<string, unknown> = { ...SCALAR_DEFAULTS };
    const val = this.projectSettingsDAO.get(projectId, key as string);
    if (val === undefined) {
      if (key === "buildProfile") return { ...DEFAULT_BUILD_PROFILE } as ProjectSettings[K];
      return defaults[key as string] as ProjectSettings[K];
    }
    if (JSON_KEYS.has(key as string)) {
      try {
        return JSON.parse(val) as ProjectSettings[K];
      } catch (err) {
        logger.warn({ projectId, key, err }, "JSON setting parse failed");
        if (key === "buildProfile") return { ...DEFAULT_BUILD_PROFILE } as ProjectSettings[K];
        return defaults[key as string] as ProjectSettings[K];
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
   * 해석 체인: "none" → 하드코딩 SDK → 등록 SDK(sdk-*) → custom 폴백
   * 사용자가 개별 필드를 override하면 그 값이 우선한다.
   */
  resolveBuildProfile(partial: Partial<BuildProfile>): BuildProfile {
    const sdkId = partial.sdkId ?? "custom";
    const sdkDefaults = this.resolveDefaults(sdkId);

    return {
      sdkId,
      compiler: partial.compiler ?? sdkDefaults.compiler ?? DEFAULT_BUILD_PROFILE.compiler,
      compilerVersion: partial.compilerVersion ?? sdkDefaults.compilerVersion,
      targetArch: partial.targetArch ?? sdkDefaults.targetArch ?? DEFAULT_BUILD_PROFILE.targetArch,
      languageStandard: partial.languageStandard ?? sdkDefaults.languageStandard ?? DEFAULT_BUILD_PROFILE.languageStandard,
      headerLanguage: partial.headerLanguage ?? sdkDefaults.headerLanguage ?? DEFAULT_BUILD_PROFILE.headerLanguage,
      includePaths: partial.includePaths ?? sdkDefaults.includePaths,
      defines: partial.defines ?? sdkDefaults.defines,
      flags: partial.flags ?? sdkDefaults.flags,
    };
  }

  private resolveDefaults(sdkId: string): Partial<BuildProfile> {
    // 1. "none" — SDK 미사용, 최소 프로파일
    if (sdkId === "none") return NONE_BUILD_PROFILE;

    // 2. 하드코딩 SDK 프로파일 (13개)
    const builtIn = findSdkProfile(sdkId);
    if (builtIn) return builtIn.defaults;

    // 3. 등록 SDK (sdk-*) — DB에서 조회
    if (sdkId.startsWith("sdk-") && this.sdkRegistryLookup) {
      const registered = this.sdkRegistryLookup.findById(sdkId);
      if (registered?.status === "ready" && registered.profile) {
        return {
          compiler: registered.profile.compiler,
          compilerVersion: registered.profile.gccVersion,
          targetArch: registered.profile.targetArch,
          languageStandard: registered.profile.languageStandard,
          includePaths: registered.profile.includePaths,
          defines: registered.profile.defines,
        };
      }
    }

    // 4. fallback — custom
    return DEFAULT_BUILD_PROFILE;
  }
}
