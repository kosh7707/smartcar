import crypto from "crypto";
import type { BuildTarget, BuildProfile } from "@aegis/shared";
import type { IBuildTargetDAO } from "../dao/interfaces";
import type { ProjectSettingsService } from "./project-settings.service";
import { createLogger } from "../lib/logger";
import { NotFoundError, InvalidInputError } from "../lib/errors";

const logger = createLogger("build-target-service");

export class BuildTargetService {
  constructor(
    private dao: IBuildTargetDAO,
    private settingsService: ProjectSettingsService,
  ) {}

  create(
    projectId: string,
    name: string,
    relativePath: string,
    buildProfile?: Partial<BuildProfile>,
    buildSystem?: string,
  ): BuildTarget {
    const now = new Date().toISOString();
    const resolved = this.settingsService.resolveBuildProfile(
      buildProfile ?? this.settingsService.get(projectId, "buildProfile") ?? {},
    );

    const target: BuildTarget = {
      id: `target-${crypto.randomUUID()}`,
      projectId,
      name,
      relativePath: relativePath.endsWith("/") ? relativePath : `${relativePath}/`,
      buildProfile: resolved,
      buildSystem: buildSystem as BuildTarget["buildSystem"],
      createdAt: now,
      updatedAt: now,
    };

    this.dao.save(target);
    logger.info({ projectId, targetId: target.id, name }, "Build target created");
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
    fields: { name?: string; relativePath?: string; buildProfile?: BuildProfile; buildSystem?: string },
  ): BuildTarget {
    const updated = this.dao.update(id, fields);
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
}
