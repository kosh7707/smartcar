import type { Rule } from "@smartcar/shared";
import type { DatabaseType } from "../db";
import type { IRuleDAO } from "./interfaces";

function rowToRule(row: any): Rule {
  return {
    id: row.id,
    name: row.name,
    severity: row.severity,
    description: row.description,
    suggestion: row.suggestion,
    pattern: row.pattern,
    fixCode: row.fix_code ?? undefined,
    enabled: row.enabled === 1,
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}

export class RuleDAO implements IRuleDAO {
  private insertStmt;
  private selectAllStmt;
  private selectByIdStmt;
  private selectByProjectStmt;
  private updateStmt;
  private toggleStmt;
  private deleteStmt;
  private deleteByProjectStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT OR IGNORE INTO rules (id, name, severity, description, suggestion, pattern, fix_code, enabled, project_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectAllStmt = db.prepare(`SELECT * FROM rules ORDER BY created_at ASC`);
    this.selectByIdStmt = db.prepare(`SELECT * FROM rules WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM rules WHERE project_id = ? ORDER BY created_at ASC`
    );
    this.updateStmt = db.prepare(
      `UPDATE rules SET name = ?, severity = ?, description = ?, suggestion = ?, pattern = ?, fix_code = ?, enabled = ? WHERE id = ?`
    );
    this.toggleStmt = db.prepare(`UPDATE rules SET enabled = ? WHERE id = ?`);
    this.deleteStmt = db.prepare(`DELETE FROM rules WHERE id = ?`);
    this.deleteByProjectStmt = db.prepare(`DELETE FROM rules WHERE project_id = ?`);
  }

  save(rule: Rule): void {
    this.insertStmt.run(
      rule.id, rule.name, rule.severity, rule.description,
      rule.suggestion, rule.pattern, rule.fixCode ?? null,
      rule.enabled ? 1 : 0, rule.projectId, rule.createdAt
    );
  }

  findAll(): Rule[] {
    return this.selectAllStmt.all().map(rowToRule);
  }

  findByProjectId(projectId: string): Rule[] {
    return (this.selectByProjectStmt.all(projectId) as any[]).map(rowToRule);
  }

  findById(id: string): Rule | undefined {
    const row = this.selectByIdStmt.get(id);
    return row ? rowToRule(row) : undefined;
  }

  update(id: string, fields: Partial<Omit<Rule, "id" | "projectId" | "createdAt">>): Rule | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const name = fields.name ?? existing.name;
    const severity = fields.severity ?? existing.severity;
    const description = fields.description ?? existing.description;
    const suggestion = fields.suggestion ?? existing.suggestion;
    const pattern = fields.pattern ?? existing.pattern;
    const fixCode = fields.fixCode !== undefined ? fields.fixCode : existing.fixCode;
    const enabled = fields.enabled !== undefined ? fields.enabled : existing.enabled;

    this.updateStmt.run(name, severity, description, suggestion, pattern, fixCode ?? null, enabled ? 1 : 0, id);
    return { ...existing, name, severity, description, suggestion, pattern, fixCode, enabled };
  }

  toggleEnabled(id: string, enabled: boolean): boolean {
    const result = this.toggleStmt.run(enabled ? 1 : 0, id);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = this.deleteStmt.run(id);
    return result.changes > 0;
  }

  deleteByProjectId(projectId: string): number {
    const result = this.deleteByProjectStmt.run(projectId);
    return result.changes;
  }
}
