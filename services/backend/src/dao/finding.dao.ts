import type { Finding, FindingStatus, Severity, AnalysisModule } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IFindingDAO, FindingFilters } from "./interfaces";

function rowToFinding(row: any): Finding {
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
      `INSERT INTO findings (id, run_id, project_id, module, status, severity, confidence, source_type, title, description, location, suggestion, detail, rule_id, fingerprint, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    const row = this.selectByIdStmt.get(id);
    return row ? rowToFinding(row) : undefined;
  }

  findByRunId(runId: string): Finding[] {
    return this.selectByRunStmt.all(runId).map(rowToFinding);
  }

  findByProjectId(projectId: string, filters?: FindingFilters): Finding[] {
    if (!filters || (!filters.status && !filters.severity && !filters.module && !filters.runId && !filters.from && !filters.to)) {
      return this.selectByProjectStmt.all(projectId).map(rowToFinding);
    }

    const conditions = ["project_id = ?"];
    const params: any[] = [projectId];

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

    const sql = `SELECT * FROM findings WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`;
    return this.db.prepare(sql).all(...params).map(rowToFinding);
  }

  findByFingerprint(projectId: string, fingerprint: string): Finding | undefined {
    const row = this.db.prepare(
      `SELECT * FROM findings WHERE project_id = ? AND fingerprint = ? ORDER BY created_at DESC LIMIT 1`,
    ).get(projectId, fingerprint);
    return row ? rowToFinding(row) : undefined;
  }

  updateStatus(id: string, status: FindingStatus): void {
    this.updateStatusStmt.run(status, new Date().toISOString(), id);
  }

  summaryByProjectId(projectId: string): { byStatus: Record<string, number>; bySeverity: Record<string, number>; total: number } {
    const rows = this.selectByProjectStmt.all(projectId).map(rowToFinding);
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
    const params: any[] = [projectId, module];
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
    const params: any[] = [projectId, module];
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
    const params: any[] = [projectId, module];
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
}
