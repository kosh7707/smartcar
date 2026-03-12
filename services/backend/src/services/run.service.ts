import type { Run, Finding } from "@smartcar/shared";
import { runDAO } from "../dao/run.dao";
import { findingDAO } from "../dao/finding.dao";

export class RunService {
  findById(id: string): (Run & { findings: Finding[] }) | undefined {
    const run = runDAO.findById(id);
    if (!run) return undefined;

    const findings = findingDAO.findByRunId(id);
    return { ...run, findings };
  }

  findByProjectId(projectId: string): Run[] {
    return runDAO.findByProjectId(projectId);
  }
}
