export type ProjectExplorerEmptyActionKind = "clear-filter" | "start-project" | null;

export interface ProjectExplorerEmptyState {
  title: string;
  description: string;
  actionKind: ProjectExplorerEmptyActionKind;
}

interface GetProjectExplorerEmptyStateArgs {
  loading: boolean;
  totalProjects: number;
  filter: string;
}

export function useDashboardExplorerEmptyState({
  loading,
  totalProjects,
  filter,
}: GetProjectExplorerEmptyStateArgs): ProjectExplorerEmptyState {
  if (loading && totalProjects === 0) {
    return {
      title: "프로젝트 목록을 불러오는 중",
      description: "최근 작업 공간과 상태를 불러와 Explorer를 준비하고 있습니다.",
      actionKind: null,
    };
  }

  if (filter.trim()) {
    return {
      title: "검색 결과가 없습니다",
      description: `“${filter.trim()}”와 일치하는 프로젝트가 없습니다. 검색어를 줄이거나 초기화해보세요.`,
      actionKind: "clear-filter",
    };
  }

  if (totalProjects === 0) {
    return {
      title: "아직 프로젝트가 없습니다",
      description: "첫 프로젝트를 만들면 이곳에서 상태와 최근 흐름을 바로 탐색할 수 있습니다.",
      actionKind: "start-project",
    };
  }

  return {
    title: "표시할 프로젝트가 없습니다",
    description: "현재 조건에서 Explorer에 표시할 항목이 없습니다.",
    actionKind: null,
  };
}
