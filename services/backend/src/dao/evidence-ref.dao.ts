import type { EvidenceRef } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO evidence_refs (id, finding_id, artifact_id, artifact_type, locator_type, locator, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const selectByFindingStmt = db.prepare(
  `SELECT * FROM evidence_refs WHERE finding_id = ? ORDER BY created_at`
);

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

class EvidenceRefDAO {
  save(ref: EvidenceRef): void {
    insertStmt.run(
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
    const tx = db.transaction((items: EvidenceRef[]) => {
      for (const r of items) this.save(r);
    });
    tx(refs);
  }

  findByFindingId(findingId: string): EvidenceRef[] {
    return selectByFindingStmt.all(findingId).map(rowToEvidenceRef);
  }
}

export const evidenceRefDAO = new EvidenceRefDAO();
