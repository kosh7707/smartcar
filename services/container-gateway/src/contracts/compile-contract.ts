export interface CompileProfile {
  language: "c" | "cpp";
  entryFile: string;
  outputName: string;
  compiler?: string;
  flags?: string[];
  includePaths?: string[];
}

export interface CompileRequest {
  workspaceId: string;
  profile: CompileProfile;
}

export interface CompileResponse {
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
  artifactPaths: string[];
  reused: boolean;
}
