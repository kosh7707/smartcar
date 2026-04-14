export interface ExecRequest {
  workspaceId: string;
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
}

export interface ExecResponse {
  projectId: string;
  uploadId: string;
  workspaceId: string;
  workspaceVersion: number;
  containerName: string;
  containerId?: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  reused: boolean;
  workingDirectory: string;
  command: string;
  args: string[];
  durationMs: number;
}

export interface AllowedCommandsResponse {
  commands: string[];
  note: string;
}
