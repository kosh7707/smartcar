import type { Finding, FindingStatus, Severity, AnalysisModule, Confidence, FindingSourceType } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IFindingDAO, FindingFilters } from "./interfaces";

interface FindingRow {
  id: string;
  run_id: string;
  project_id: string;
  module: AnalysisModule;
  status: FindingStatus;
  severity: Severity;
  confidence: Confidence;
  source_type: FindingSourceType;
  title: string;
  description: string;
  location: string | null;
  suggestion: string | null;
  detail: string | null;
  rule_id: string | null;
  cwe_id: string | null;
  cve_ids: string | null;
  confidence_score: number | null;
  fingerprint: string | null;
  created_at: string;
  updated_at: string;
}

function rowToFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    runId: row.run_id,
    projectId: row.project_id,
    module: row.module,
    status: row.status,
    severity: row.severity,
    confidence: row.confidence,
    sourceType: row.source_type,
    title: row.title,
    description: row.description,
    location: row.location ?? undefined,
    suggestion: row.suggestion ?? undefined,
    detail: row.detail ?? undefined,
    ruleId: row.rule_id ?? undefined,
    cweId: row.cwe_id ?? undefined,
    cveIds: row.cve_ids && row.cve_ids !== "[]" ? JSON.parse(row.cve_ids) : undefined,
    confidenceScore: row.confidence_score ?? undefined,
    fingerprint: row.fingerprint ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class FindingDAO implements IFindingDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectByRunStmt;
  private selectByProjectStmt;
  private updateStatusStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO findings (id, run_id, project_id, module, status, severity, confidence, source_type, title, description, location, suggestion, detail, rule_id, cwe_id, cve_ids, confidence_score, fingerprint, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM findings WHERE id = ?`);
    this.selectByRunStmt = db.prepare(
      `SELECT * FROM findings WHERE run_id = ? ORDER BY created_at DESC`
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM findings WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.updateStatusStmt = db.prepare(
      `UPDATE findings SET status = ?, updated_at = ? WHERE id = ?`
    );
  }

  save(finding: Finding): void {
    this.insertStmt.run(
      finding.id,
      finding.runId,
      finding.projectId,
      finding.module,
      finding.status,
      finding.severity,
      finding.confidence,
      finding.sourceType,
      finding.title,
      finding.description,
      finding.location ?? null,
      finding.suggestion ?? null,
      finding.detail ?? null,
      finding.ruleId ?? null,
      finding.cweId ?? null,
      JSON.stringify(finding.cveIds ?? []),
      finding.confidenceScore ?? null,
      finding.fingerprint ?? null,
      finding.createdAt,
      finding.updatedAt
    );
  }

  saveMany(findings: Finding[]): void {
    const tx = this.db.transaction((items: Finding[]) => {
      for (const f of items) this.save(f);
    });
    tx(findings);
  }

  findById(id: string): Finding | undefined {
    const row = this.selectByIdStmt.get(id) as FindingRow | undefined;
    return row ? rowToFinding(row) : undefined;
  }

  findByRunId(runId: string): Finding[] {
    return (this.selectByRunStmt.all(runId) as FindingRow[]).map(rowToFinding);
  }

  findByIds(ids: string[]): Finding[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    return (this.db
      .prepare(`SELECT * FROM findings WHERE id IN (${placeholders})`)
      .all(...ids) as FindingRow[]).map(rowToFinding);
  }

  findByProjectId(projectId: string, filters?: FindingFilters): Finding[] {
    const hasFilters = filters && (
      filters.status || filters.severity || filters.module || filters.runId ||
      filters.from || filters.to || filters.q || filters.sourceType || filters.sort
    );
    if (!hasFilters) {
      return (this.selectByProjectStmt.all(projectId) as FindingRow[]).map(rowToFinding);
    }

    const conditions = ["project_id = ?"];
    const params: (string | number | null)[] = [projectId];

    if (filters.status) {
      const arr = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(`status IN (${arr.map(() => "?").join(",")})`);
      params.push(...arr);
    }
    if (filters.severity) {
      const arr = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      conditions.push(`severity IN (${arr.map(() => "?").join(",")})`);
      params.push(...arr);
    }
    if (filters.module) {
      conditions.push("module = ?");
      params.push(filters.module);
    }
    if (filters.runId) {
      conditions.push("run_id = ?");
      params.push(filters.runId);
    }
    if (filters.from) {
      conditions.push("created_at >= ?");
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push("created_at <= ?");
      params.push(filters.to);
    }
    if (filters.sourceType) {
      conditions.push("source_type = ?");
      params.push(filters.sourceType);
    }
    if (filters.q) {
      conditions.push("(title LIKE ? OR description LIKE ? OR location LIKE ?)");
      const pattern = `%${filters.q}%`;
      params.push(pattern, pattern, pattern);
    }

    let orderClause = "ORDER BY created_at DESC";
    if (filters.sort) {
      const columnMap: Record<string, string> = {
        severity: "CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 WHEN 'info' THEN 5 ELSE 6 END",
        createdAt: "created_at",
        location: "location",
      };
      const column = columnMap[filters.sort];
      const direction = filters.order === "asc" ? "ASC" : "DESC";
      orderClause = `ORDER BY ${column} ${direction}`;
    }

    const sql = `SELECT * FROM findings WHERE ${conditions.join(" AND ")} ${orderClause}`;
    return (this.db.prepare(sql).all(...params) as FindingRow[]).map(rowToFinding);
  }

  findByFingerprint(projectId: string, fingerprint: string): Finding | undefined {
    const row = this.db.prepare(
      `SELECT * FROM findings WHERE project_id = ? AND fingerprint = ? ORDER BY created_at DESC LIMIT 1`,
    ).get(projectId, fingerprint) as FindingRow | undefined;
    return row ? rowToFinding(row) : undefined;
  }

  findAllByFingerprint(projectId: string, fingerprint: string): Finding[] {
    return (this.db.prepare(
      `SELECT * FROM findings WHERE project_id = ? AND fingerprint = ? ORDER BY created_at DESC`,
    ).all(projectId, fingerprint) as FindingRow[]).map(rowToFinding);
  }

  updateStatus(id: string, status: FindingStatus): void {
    this.updateStatusStmt.run(status, new Date().toISOString(), id);
  }

  withTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  summaryByProjectId(projectId: string): { byStatus: Record<string, number>; bySeverity: Record<string, number>; total: number } {
    const rows = (this.selectByProjectStmt.all(projectId) as FindingRow[]).map(rowToFinding);
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const f of rows) {
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }

    return { byStatus, bySeverity, total: rows.length };
  }

  summaryByModule(
    projectId: string,
    module: string,
    since?: string
  ): { bySeverity: Record<string, number>; byStatus: Record<string, number>; bySource: Record<string, number>; total: number } {
    const conditions = ["project_id = ?", "module = ?"];
    const params: (string | number | null)[] = [projectId, module];
    if (since) {
      conditions.push("created_at >= ?");
      params.push(since);
    }

    const sql = `SELECT severity, status, source_type FROM findings WHERE ${conditions.join(" AND ")}`;
    const rows = this.db.prepare(sql).all(...params) as Array<{ severity: string; status: string; source_type: string }>;

    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const row of rows) {
      bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      bySource[row.source_type] = (bySource[row.source_type] ?? 0) + 1;
    }

    return { bySeverity, byStatus, bySource, total: rows.length };
  }

  topFilesByModule(
    projectId: string,
    module: string,
    limit = 10,
    since?: string
  ): Array<{ filePath: string; findingCount: number; topSeverity: string }> {
    const conditions = ["project_id = ?", "module = ?", "location IS NOT NULL"];
    const params: (string | number | null)[] = [projectId, module];
    if (since) {
      conditions.push("created_at >= ?");
      params.push(since);
    }

    const sql = `
      SELECT location, COUNT(*) as cnt,
        MIN(CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          WHEN 'info' THEN 5
          ELSE 6 END) as sev_rank
      FROM findings
      WHERE ${conditions.join(" AND ")}
      GROUP BY location
      ORDER BY cnt DESC
      LIMIT ?
    `;
    params.push(limit);

    const sevMap: Record<number, string> = { 1: "critical", 2: "high", 3: "medium", 4: "low", 5: "info" };
    const rows = this.db.prepare(sql).all(...params) as Array<{ location: string; cnt: number; sev_rank: number }>;

    return rows.map((row) => ({
      filePath: row.location,
      findingCount: row.cnt,
      topSeverity: sevMap[row.sev_rank] ?? "info",
    }));
  }

  topRulesByModule(
    projectId: string,
    module: string,
    limit = 10,
    since?: string
  ): Array<{ ruleId: string; hitCount: number }> {
    const conditions = ["project_id = ?", "module = ?", "rule_id IS NOT NULL"];
    const params: (string | number | null)[] = [projectId, module];
    if (since) {
      conditions.push("created_at >= ?");
      params.push(since);
    }

    const sql = `
      SELECT rule_id, COUNT(*) as cnt
      FROM findings
      WHERE ${conditions.join(" AND ")}
      GROUP BY rule_id
      ORDER BY cnt DESC
      LIMIT ?
    `;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Array<{ rule_id: string; cnt: number }>;
    return rows.map((row) => ({ ruleId: row.rule_id, hitCount: row.cnt }));
  }

  /** 미해결 Finding 건수 */
  unresolvedCountByProjectId(projectId: string, opts?: { createdBefore?: string }): number {
    const unresolved = "('open','needs_review','needs_revalidation','sandbox')";
    if (opts?.createdBefore) {
      const row = this.db.prepare(
        `SELECT COUNT(*) as cnt FROM findings WHERE project_id = ? AND status IN ${unresolved} AND created_at <= ?`,
      ).get(projectId, opts.createdBefore) as { cnt: number };
      return row.cnt;
    }
    const row = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM findings WHERE project_id = ? AND status IN ${unresolved}`,
    ).get(projectId) as { cnt: number };
    return row.cnt;
  }

  /** 미해결 Finding의 심각도별 분포 */
  severitySummaryByProjectId(projectId: string): { critical: number; high: number; medium: number; low: number } {
    const unresolved = "('open','needs_review','needs_revalidation','sandbox')";
    const row = this.db.prepare(`
      SELECT
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low
      FROM findings WHERE project_id = ? AND status IN ${unresolved}
    `).get(projectId) as { critical: number; high: number; medium: number; low: number };
    return row;
  }

  /** 특정 시점 이후 해결된 Finding 건수 */
  resolvedCountSince(projectId: string, since: string): number {
    const row = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM findings WHERE project_id = ? AND status IN ('fixed','false_positive','accepted_risk') AND updated_at >= ?`,
    ).get(projectId, since) as { cnt: number };
    return row.cnt;
  }

  /** ruleId 기준 그루핑 */
  groupByRuleId(projectId: string): Array<{ key: string; count: number; topSeverity: string; findingIds: string[] }> {
    const sevMap = ["critical", "high", "medium", "low", "info"];
    const rows = this.db.prepare(`
      SELECT rule_id, COUNT(*) as cnt,
        MIN(CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END) as top_sev,
        GROUP_CONCAT(id) as ids
      FROM findings WHERE project_id = ? AND rule_id IS NOT NULL
      GROUP BY rule_id ORDER BY cnt DESC
    `).all(projectId) as Array<{ rule_id: string; cnt: number; top_sev: number; ids: string }>;
    return rows.map((r) => ({
      key: r.rule_id,
      count: r.cnt,
      topSeverity: sevMap[r.top_sev - 1] ?? "info",
      findingIds: r.ids.split(","),
    }));
  }

  /** location(파일 경로) 기준 그루핑 */
  groupByLocation(projectId: string): Array<{ key: string; count: number; topSeverity: string; findingIds: string[] }> {
    const sevMap = ["critical", "high", "medium", "low", "info"];
    const rows = this.db.prepare(`
      SELECT
        CASE WHEN INSTR(location, ':') > 0 THEN SUBSTR(location, 1, INSTR(location, ':') - 1) ELSE location END as file_path,
        COUNT(*) as cnt,
        MIN(CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END) as top_sev,
        GROUP_CONCAT(id) as ids
      FROM findings WHERE project_id = ? AND location IS NOT NULL
      GROUP BY file_path ORDER BY cnt DESC
    `).all(projectId) as Array<{ file_path: string; cnt: number; top_sev: number; ids: string }>;
    return rows.map((r) => ({
      key: r.file_path,
      count: r.cnt,
      topSeverity: sevMap[r.top_sev - 1] ?? "info",
      findingIds: r.ids.split(","),
    }));
  }
}
