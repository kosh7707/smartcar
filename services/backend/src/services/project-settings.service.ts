import type { ProjectSettings } from "@smartcar/shared";
import type { IProjectSettingsDAO } from "../dao/interfaces";

const DEFAULTS: ProjectSettings = {
  llmUrl: process.env.LLM_GATEWAY_URL ?? "http://localhost:8000",
};

const KNOWN_KEYS = new Set<keyof ProjectSettings>(Object.keys(DEFAULTS) as Array<keyof ProjectSettings>);

export class ProjectSettingsService {
  constructor(private projectSettingsDAO: IProjectSettingsDAO) {}

  getAll(projectId: string): ProjectSettings {
    const overrides = this.projectSettingsDAO.getAll(projectId);
    return { ...DEFAULTS, ...pick(overrides, KNOWN_KEYS) };
  }

  get<K extends keyof ProjectSettings>(projectId: string, key: K): ProjectSettings[K] {
    const val = this.projectSettingsDAO.get(projectId, key as string);
    return (val ?? DEFAULTS[key]) as ProjectSettings[K];
  }

  update(projectId: string, partial: Partial<ProjectSettings>): ProjectSettings {
    for (const [key, value] of Object.entries(partial)) {
      if (!KNOWN_KEYS.has(key as keyof ProjectSettings)) continue;
      if (value === undefined || value === null || value === "") {
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
    return { ...DEFAULTS };
  }
}

function pick(obj: Record<string, string>, keys: Set<keyof ProjectSettings>): Partial<ProjectSettings> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (keys.has(k as keyof ProjectSettings)) result[k] = v;
  }
  return result;
}
