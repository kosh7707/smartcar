import crypto from "crypto";
import fs from "fs";
import path from "path";
import { TextDecoder } from "util";
import type { BuildTarget, BuildProfile } from "@aegis/shared";
import type { IBuildTargetDAO } from "../dao/interfaces";
import type { ProjectSettingsService } from "./project-settings.service";
import type { ProjectSourceService } from "./project-source.service";
import { createLogger } from "../lib/logger";
import { NotFoundError, InvalidInputError } from "../lib/errors";

const logger = createLogger("build-target-service");
const SCRIPT_HINT_MAX_BYTES = 20_000;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

export class BuildTargetService {
  constructor(
    private dao: IBuildTargetDAO,
    private settingsService: ProjectSettingsService,
    private sourceService?: ProjectSourceService,
  ) {}

  create(
    projectId: string,
    name: string,
    relativePath: string,
    buildProfile?: Partial<BuildProfile>,
    buildSystem?: string,
    includedPaths?: string[],
    scriptHintPath?: string | null,
  ): BuildTarget {
    const now = new Date().toISOString();
    const sdkChoiceState = this.resolveSdkChoiceState(buildProfile);
    const resolved = this.settingsService.resolveBuildProfile(
      buildProfile ?? this.settingsService.get(projectId, "buildProfile") ?? {},
    );

    const targetId = `target-${crypto.randomUUID()}`;

    // includedPaths가 있으면 물리적 복사
    let sourcePath: string | undefined;
    if (includedPaths?.length && this.sourceService) {
      sourcePath = this.sourceService.copyToBuildTargetSource(projectId, targetId, includedPaths);
    }

    const normalizedScriptHintPath = this.validateScriptHintPath(
      projectId,
      relativePath,
      sourcePath,
      scriptHintPath,
    );

    const target: BuildTarget = {
      id: targetId,
      projectId,
      name,
      relativePath: relativePath.endsWith("/") ? relativePath : `${relativePath}/`,
      includedPaths: includedPaths?.length ? includedPaths : undefined,
      sourcePath,
      scriptHintPath: normalizedScriptHintPath,
      buildProfile: resolved,
      sdkChoiceState,
      buildSystem: buildSystem as BuildTarget["buildSystem"],
      status: "discovered",
      createdAt: now,
      updatedAt: now,
    };

    this.dao.save(target);
    logger.info(
      { projectId, targetId, name, includedPaths: includedPaths?.length ?? 0, sourcePath, hasScriptHintPath: !!normalizedScriptHintPath },
      "Build target created",
    );
    return target;
  }

  findByProjectId(projectId: string): BuildTarget[] {
    return this.dao.findByProjectId(projectId);
  }

  findById(id: string): BuildTarget | undefined {
    return this.dao.findById(id);
  }

  update(
    id: string,
    fields: { name?: string; relativePath?: string; buildProfile?: BuildProfile; buildSystem?: string; scriptHintPath?: string | null },
  ): BuildTarget {
    const existing = this.dao.findById(id);
    if (!existing) throw new NotFoundError(`Build target not found: ${id}`);

    const nextRelativePath = fields.relativePath ?? existing.relativePath;
    let scriptHintPath: string | null | undefined;
    if (fields.scriptHintPath === null) {
      scriptHintPath = null;
    } else if (fields.scriptHintPath !== undefined) {
      scriptHintPath = this.validateScriptHintPath(
        existing.projectId,
        nextRelativePath,
        existing.sourcePath,
        fields.scriptHintPath,
      );
    } else if (fields.relativePath !== undefined && existing.scriptHintPath) {
      this.validateScriptHintPath(
        existing.projectId,
        nextRelativePath,
        existing.sourcePath,
        existing.scriptHintPath,
      );
    }

    const updated = this.dao.update(id, {
      ...fields,
      ...(fields.scriptHintPath !== undefined ? { scriptHintPath } : {}),
      ...(fields.buildProfile ? { sdkChoiceState: this.resolveSdkChoiceState(fields.buildProfile) } : {}),
    });
    if (!updated) throw new NotFoundError(`Build target not found: ${id}`);
    logger.info({ targetId: id }, "Build target updated");
    return updated;
  }

  delete(id: string): boolean {
    const result = this.dao.delete(id);
    if (result) logger.info({ targetId: id }, "Build target deleted");
    return result;
  }

  deleteByProjectId(projectId: string): number {
    return this.dao.deleteByProjectId(projectId);
  }

  /** S4 탐색 결과로 타겟 일괄 등록 */
  bulkCreateFromDiscovery(
    projectId: string,
    discovered: Array<{ name: string; relativePath: string; buildSystem: string }>,
  ): BuildTarget[] {
    const existing = this.dao.findByProjectId(projectId);
    const existingPaths = new Set(existing.map((t) => t.relativePath));

    const created: BuildTarget[] = [];
    for (const d of discovered) {
      const rp = d.relativePath.endsWith("/") ? d.relativePath : `${d.relativePath}/`;
      if (existingPaths.has(rp)) continue; // 이미 등록된 경로는 스킵

      const target = this.create(projectId, d.name, d.relativePath, undefined, d.buildSystem);
      created.push(target);
    }

    logger.info(
      { projectId, discovered: discovered.length, created: created.length, skipped: discovered.length - created.length },
      "Bulk create from discovery",
    );
    return created;
  }

  private resolveSdkChoiceState(buildProfile?: Partial<BuildProfile>): BuildTarget["sdkChoiceState"] {
    if (!buildProfile?.sdkId) return "sdk-unresolved";
    if (buildProfile.sdkId === "none") return "sdk-none-explicit";
    return "sdk-selected";
  }

  private validateScriptHintPath(
    projectId: string,
    targetRelativePath: string,
    sourcePath: string | undefined,
    scriptHintPath: string | null | undefined,
  ): string | undefined {
    if (scriptHintPath == null) return undefined;
    if (typeof scriptHintPath !== "string") {
      throw new InvalidInputError("scriptHintPath must be a string");
    }

    const raw = scriptHintPath.trim();
    if (!raw) throw new InvalidInputError("scriptHintPath must not be empty");
    if (raw.includes("\0")) throw new InvalidInputError("scriptHintPath must not contain NUL bytes");
    if (raw.includes("\\")) throw new InvalidInputError("scriptHintPath must use POSIX '/' separators");
    if (raw.startsWith("//") || /^[A-Za-z]:/.test(raw) || path.isAbsolute(raw)) {
      throw new InvalidInputError("scriptHintPath must be relative to the BuildTarget root");
    }

    const segments = raw.split("/");
    if (segments.some((segment) => segment === "..")) {
      throw new InvalidInputError("scriptHintPath must not contain '..'");
    }

    const normalized = path.posix.normalize(raw);
    if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
      throw new InvalidInputError("scriptHintPath must resolve inside the BuildTarget root");
    }

    const effectiveRoot = this.resolveEffectiveBuildTargetRoot(projectId, targetRelativePath, sourcePath);
    const resolved = path.resolve(effectiveRoot, normalized);
    if (!isPathInside(effectiveRoot, resolved)) {
      throw new InvalidInputError("scriptHintPath must resolve inside the BuildTarget root");
    }
    if (!fs.existsSync(resolved)) {
      throw new InvalidInputError(`scriptHintPath file not found: ${normalized}`);
    }

    const realRoot = fs.realpathSync(effectiveRoot);
    const realFile = fs.realpathSync(resolved);
    if (!isPathInside(realRoot, realFile)) {
      throw new InvalidInputError("scriptHintPath symlink escapes the BuildTarget root");
    }

    const stat = fs.statSync(realFile);
    if (!stat.isFile()) {
      throw new InvalidInputError("scriptHintPath must reference a regular file");
    }
    if (stat.size > SCRIPT_HINT_MAX_BYTES) {
      throw new InvalidInputError(`scriptHintPath file exceeds ${SCRIPT_HINT_MAX_BYTES} bytes`);
    }

    const buffer = fs.readFileSync(realFile);
    if (buffer.includes(0)) {
      throw new InvalidInputError("scriptHintPath file must be text (NUL byte found)");
    }
    try {
      UTF8_DECODER.decode(buffer);
    } catch {
      throw new InvalidInputError("scriptHintPath file must be valid UTF-8 text");
    }

    return normalized;
  }

  private resolveEffectiveBuildTargetRoot(
    projectId: string,
    targetRelativePath: string,
    sourcePath?: string,
  ): string {
    if (sourcePath) {
      if (!fs.existsSync(sourcePath)) {
        throw new InvalidInputError("BuildTarget sourcePath does not exist");
      }
      return path.resolve(sourcePath);
    }
    if (!this.sourceService) {
      throw new InvalidInputError("Project source service is required to validate scriptHintPath");
    }
    const projectPath = this.sourceService.getProjectPath(projectId);
    if (!projectPath) throw new NotFoundError(`Project source not found: ${projectId}`);

    const targetRoot = path.resolve(projectPath, targetRelativePath);
    if (!isPathInside(projectPath, targetRoot)) {
      throw new InvalidInputError("relativePath must resolve inside the uploaded project");
    }
    if (!fs.existsSync(targetRoot)) {
      throw new InvalidInputError("BuildTarget root does not exist for scriptHintPath validation");
    }
    return targetRoot;
  }
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}
