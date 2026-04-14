import type { Run, Finding, GateResult, EvidenceRef } from "@aegis/shared";
import type { IRunDAO, IFindingDAO, IGateResultDAO, IEvidenceRefDAO } from "../dao/interfaces";
import { isVisibleAnalysisArtifact } from "../lib/analysis-visibility";

export interface RunDetail {
  run: Run;
  gate?: GateResult;
  findings: Array<{ finding: Finding; evidenceRefs: EvidenceRef[] }>;
}

export class RunService {
  constructor(
    private runDAO: IRunDAO,
    private findingDAO: IFindingDAO,
    private gateResultDAO: IGateResultDAO,
    private evidenceRefDAO: IEvidenceRefDAO,
  ) {}

  findById(id: string): RunDetail | undefined {
    const run = this.runDAO.findById(id);
    if (!run || !isVisibleAnalysisArtifact(run)) return undefined;

    const gate = this.gateResultDAO.findByRunId(id);
    const findings = this.findingDAO.findByRunId(id);

    // 벌크 evidence 조회 (N+1 방지)
    const findingIds = findings.map((f) => f.id);
    const evidenceMap = this.evidenceRefDAO.findByFindingIds(findingIds);

    const findingsWithEvidence = findings.map((finding) => ({
      finding,
      evidenceRefs: evidenceMap.get(finding.id) ?? [],
    }));

    return { run, gate, findings: findingsWithEvidence };
  }

  findByProjectId(projectId: string): Run[] {
    return this.runDAO.findByProjectId(projectId).filter((run) => isVisibleAnalysisArtifact(run));
  }
}
