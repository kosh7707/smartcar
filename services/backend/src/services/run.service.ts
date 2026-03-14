import type { Run, Finding, GateResult, EvidenceRef } from "@smartcar/shared";
import { runDAO } from "../dao/run.dao";
import { findingDAO } from "../dao/finding.dao";
import { gateResultDAO } from "../dao/gate-result.dao";
import { evidenceRefDAO } from "../dao/evidence-ref.dao";

export interface RunDetail {
  run: Run;
  gate?: GateResult;
  findings: Array<{ finding: Finding; evidenceRefs: EvidenceRef[] }>;
}

export class RunService {
  findById(id: string): RunDetail | undefined {
    const run = runDAO.findById(id);
    if (!run) return undefined;

    const gate = gateResultDAO.findByRunId(id);
    const findings = findingDAO.findByRunId(id);

    // 벌크 evidence 조회 (N+1 방지)
    const findingIds = findings.map((f) => f.id);
    const evidenceMap = evidenceRefDAO.findByFindingIds(findingIds);

    const findingsWithEvidence = findings.map((finding) => ({
      finding,
      evidenceRefs: evidenceMap.get(finding.id) ?? [],
    }));

    return { run, gate, findings: findingsWithEvidence };
  }

  findByProjectId(projectId: string): Run[] {
    return runDAO.findByProjectId(projectId);
  }
}
