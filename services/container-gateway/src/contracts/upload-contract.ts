export interface UploadWorkspaceSummary {
  projectId: string;
  uploadId: string;
  workspaceId: string;
  workspaceVersion: number;
  workspacePath: string;
  fileCount: number;
  files: Array<{ relativePath: string; size: number }>;
}
