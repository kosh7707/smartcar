import type { Rule } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT OR IGNORE INTO rules (id, name, severity, description, suggestion, pattern, fix_code, enabled, project_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectAllStmt = db.prepare(`SELECT * FROM rules ORDER BY created_at ASC`);
const selectByIdStmt = db.prepare(`SELECT * FROM rules WHERE id = ?`);
const selectByProjectStmt = db.prepare(
  `SELECT * FROM rules WHERE project_id = ? ORDER BY created_at ASC`
);
const updateStmt = db.prepare(
  `UPDATE rules SET name = ?, severity = ?, description = ?, suggestion = ?, pattern = ?, fix_code = ?, enabled = ? WHERE id = ?`
);
const toggleStmt = db.prepare(`UPDATE rules SET enabled = ? WHERE id = ?`);
const deleteStmt = db.prepare(`DELETE FROM rules WHERE id = ?`);
const deleteByProjectStmt = db.prepare(`DELETE FROM rules WHERE project_id = ?`);

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

class RuleDAO {
  save(rule: Rule): void {
    insertStmt.run(
      rule.id, rule.name, rule.severity, rule.description,
      rule.suggestion, rule.pattern, rule.fixCode ?? null,
      rule.enabled ? 1 : 0, rule.projectId, rule.createdAt
    );
  }

  findAll(): Rule[] {
    return selectAllStmt.all().map(rowToRule);
  }

  findByProjectId(projectId: string): Rule[] {
    return (selectByProjectStmt.all(projectId) as any[]).map(rowToRule);
  }

  findById(id: string): Rule | undefined {
    const row = selectByIdStmt.get(id);
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

    updateStmt.run(name, severity, description, suggestion, pattern, fixCode ?? null, enabled ? 1 : 0, id);
    return { ...existing, name, severity, description, suggestion, pattern, fixCode, enabled };
  }

  toggleEnabled(id: string, enabled: boolean): boolean {
    const result = toggleStmt.run(enabled ? 1 : 0, id);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = deleteStmt.run(id);
    return result.changes > 0;
  }

  deleteByProjectId(projectId: string): number {
    const result = deleteByProjectStmt.run(projectId);
    return result.changes;
  }
}

export const ruleDAO = new RuleDAO();
