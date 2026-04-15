export function assertProjectId(projectId: string): void {
  if (!projectId || !/^[A-Za-z0-9_-]+$/.test(projectId)) {
    throw new Error("Invalid projectId");
  }
}
