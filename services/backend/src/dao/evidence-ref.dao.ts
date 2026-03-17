import type { EvidenceRef } from "@smartcar/shared";
import type { DatabaseType } from "../db";
import type { IEvidenceRefDAO } from "./interfaces";

function rowToEvidenceRef(row: any): EvidenceRef {
  return {
    id: row.id,
    findingId: row.finding_id,
    artifactId: row.artifact_id,
    artifactType: row.artifact_type,
    locatorType: row.locator_type,
    locator: JSON.parse(row.locator || "{}"),
    createdAt: row.created_at,
  };
}

export class EvidenceRefDAO implements IEvidenceRefDAO {
  private insertStmt;
  private selectByFindingStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO evidence_refs (id, finding_id, artifact_id, artifact_type, locator_type, locator, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByFindingStmt = db.prepare(
      `SELECT * FROM evidence_refs WHERE finding_id = ? ORDER BY created_at`
    );
  }

  save(ref: EvidenceRef): void {
    this.insertStmt.run(
      ref.id,
      ref.findingId,
      ref.artifactId,
      ref.artifactType,
      ref.locatorType,
      JSON.stringify(ref.locator),
      ref.createdAt
    );
  }

  saveMany(refs: EvidenceRef[]): void {
    const tx = this.db.transaction((items: EvidenceRef[]) => {
      for (const r of items) this.save(r);
    });
    tx(refs);
  }

  findByFindingId(findingId: string): EvidenceRef[] {
    return this.selectByFindingStmt.all(findingId).map(rowToEvidenceRef);
  }

  findByFindingIds(findingIds: string[]): Map<string, EvidenceRef[]> {
    const result = new Map<string, EvidenceRef[]>();
    if (findingIds.length === 0) return result;

    const placeholders = findingIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT * FROM evidence_refs WHERE finding_id IN (${placeholders}) ORDER BY created_at`,
      )
      .all(...findingIds);

    for (const row of rows) {
      const ref = rowToEvidenceRef(row);
      const list = result.get(ref.findingId);
      if (list) list.push(ref);
      else result.set(ref.findingId, [ref]);
    }
    return result;
  }
}
