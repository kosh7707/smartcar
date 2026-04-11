import type { ActivityEvent, DashboardProject } from "./dashboardTypes";
import { buildProjectChips, totalFindings } from "./dashboardProjectSignals";

function buildPrimaryActivityEvent(project: DashboardProject): ActivityEvent | null {
  const timestamp = project.lastAnalysisAt || project.updatedAt;
  if (!timestamp) {
    return null;
  }

  const findingsTotal = totalFindings(project);

  if (project.gateStatus === "fail") {
    return {
      id: `${project.id}-gate-fail`,
      projectId: project.id,
      projectName: project.name,
      type: "gate_fail",
      description: "품질 게이트에 실패했습니다",
      timestamp,
    };
  }

  if (project.gateStatus === "warning") {
    return {
      id: `${project.id}-gate-warning`,
      projectId: project.id,
      projectName: project.name,
      type: "gate_warning",
      description: "품질 게이트 경고 상태입니다",
      timestamp,
    };
  }

  if (findingsTotal > 0) {
    return {
      id: `${project.id}-vulnerability`,
      projectId: project.id,
      projectName: project.name,
      type: "vulnerability",
      description: `취약점 ${findingsTotal}건이 발견되었습니다`,
      timestamp,
    };
  }

  return {
    id: `${project.id}-analysis`,
    projectId: project.id,
    projectName: project.name,
    type: project.gateStatus === "pass" ? "gate_pass" : "analysis",
    description: project.gateStatus === "pass" ? "품질 게이트를 통과했습니다" : "정적 분석이 완료되었습니다",
    timestamp,
  };
}

export function buildActivity(projects: DashboardProject[]): ActivityEvent[] {
  return projects
    .map((project) => buildPrimaryActivityEvent(project))
    .filter((event): event is ActivityEvent => event !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
