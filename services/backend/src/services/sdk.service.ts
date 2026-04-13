import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import type {
  RegisteredSdk,
  SdkProfile,
  SdkAnalyzedProfile,
  WsSdkMessage,
  SdkProgressPhase,
  SdkErrorPhase,
  SdkArtifactKind,
  SdkRegistryStatus,
} from "@aegis/shared";
import type { SdkRegistryDAO } from "../dao/sdk-registry.dao";
import type { BuildAgentClient } from "./build-agent-client";
import type { WsBroadcaster } from "./ws-broadcaster";
import { SDK_PROFILES } from "./sdk-profiles";
import { appendSdkLogLine, buildSdkInstallLogPath, createSdkOutputCollector, type SdkLogContext } from "./sdk-log";
import { createLogger } from "../lib/logger";
import { NotFoundError, InvalidInputError } from "../lib/errors";
import type { NotificationService } from "./notification.service";

const logger = createLogger("sdk-service");
const execFileAsync = promisify(execFile);
const DEFAULT_INSTALL_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_INSTALL_HEARTBEAT_MS = 5_000;
const ETXTBSY_RETRY_COUNT = 5;
const ETXTBSY_RETRY_DELAY_MS = 200;

export interface UploadedSdkFile {
  originalName: string;
  storedPath: string;
  size: number;
  relativePath?: string;
}

export interface SdkRegistrationInput {
  sdkId?: string;
  name: string;
  description?: string;
  files: UploadedSdkFile[];
}

class SdkPipelineFailure extends Error {
  constructor(
    readonly status: SdkRegistryStatus,
    readonly phase: SdkErrorPhase,
    message: string,
    readonly logPath?: string,
  ) {
    super(message);
    this.name = "SdkPipelineFailure";
  }
}

interface MaterializedSdkResult {
  path: string;
  logPath?: string;
}

function isRelativeSafe(entry: string): boolean {
  const normalized = entry.replace(/\\/g, "/").trim();
  if (!normalized || normalized.startsWith("/") || normalized.startsWith("../")) return false;
  if (/^[A-Za-z]:/.test(normalized)) return false;
  return !normalized.split("/").some((segment) => segment === "..");
}

function inferArtifactKind(fileName: string): SdkArtifactKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".bin")) return "bin";
  return "archive";
}

function sanitizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!normalized) {
    throw new InvalidInputError("relativePath is required for folder upload");
  }
  if (!isRelativeSafe(normalized)) {
    throw new InvalidInputError(`Invalid folder upload path: ${relativePath}`);
  }
  return normalized;
}

function inferVersion(...inputs: Array<string | undefined>): string | undefined {
  for (const input of inputs) {
    if (!input) continue;
    const match = input.match(/(\d+\.\d+\.\d+(?:\.\d+)+|\d+\.\d+\.\d+)/);
    if (match) return match[1];
  }
  return undefined;
}

function inferTargetSystem(...inputs: Array<string | undefined>): string | undefined {
  for (const input of inputs) {
    if (!input) continue;
    const base = path.basename(input).replace(/\.(tar\.gz|tgz|tar|zip|bin)$/i, "");
    const normalized = base.toLowerCase();
    const tiMatch = normalized.match(/sdk-linux-([a-z0-9-]+)-\d+\.\d+\.\d+(?:\.\d+)+/);
    if (tiMatch) return tiMatch[1];
    const genericMatch = normalized.match(/(?:sdk|toolchain|installer)[-_]?([a-z0-9-]+?)(?:[-_]\d+\.\d+\.\d+(?:\.\d+)*)?$/);
    if (genericMatch?.[1]) return genericMatch[1];
  }
  return undefined;
}

function mergeProfiles(base: SdkAnalyzedProfile, patch?: SdkAnalyzedProfile): SdkAnalyzedProfile {
  return { ...base, ...(patch ?? {}) };
}

function isTextFileBusyError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error
    && (
      (typeof (err as NodeJS.ErrnoException).code === "string" && (err as NodeJS.ErrnoException).code === "ETXTBSY")
      || (typeof (err as NodeJS.ErrnoException).errno === "number" && Math.abs((err as NodeJS.ErrnoException).errno ?? 0) === 26)
      || err.message.includes("ETXTBSY")
    );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getInstallTimeoutMs(): number {
  const parsed = Number(process.env.AEGIS_SDK_INSTALL_TIMEOUT_MS ?? DEFAULT_INSTALL_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INSTALL_TIMEOUT_MS;
}

function getInstallHeartbeatMs(): number {
  const parsed = Number(process.env.AEGIS_SDK_INSTALL_HEARTBEAT_MS ?? DEFAULT_INSTALL_HEARTBEAT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INSTALL_HEARTBEAT_MS;
}

export class SdkService {
  constructor(
    private dao: SdkRegistryDAO,
    private buildAgentClient: BuildAgentClient,
    private uploadsDir: string,
    private sdkWs: WsBroadcaster<WsSdkMessage>,
    private notificationService?: NotificationService,
  ) {}

  listBuiltIn(): SdkProfile[] {
    return SDK_PROFILES;
  }

  listRegistered(projectId: string): RegisteredSdk[] {
    return this.dao.findByProjectId(projectId);
  }

  listAll(projectId: string): { builtIn: SdkProfile[]; registered: RegisteredSdk[] } {
    return {
      builtIn: this.listBuiltIn(),
      registered: this.listRegistered(projectId),
    };
  }

  findById(id: string): RegisteredSdk | undefined {
    return this.dao.findById(id);
  }

  getInstallLog(id: string, tailLines: number = 200): { sdkId: string; logPath: string; content: string; truncated: boolean } {
    const sdk = this.dao.findById(id);
    if (!sdk) throw new NotFoundError(`SDK not found: ${id}`);

    const logPath = this.resolveInstallLogPath(sdk);
    if (!fs.existsSync(logPath)) {
      throw new NotFoundError(`SDK install log not found: ${id}`);
    }

    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.split(/\r?\n/);
    const normalizedTail = Math.max(1, tailLines);
    const selected = lines.length > normalizedTail ? lines.slice(-normalizedTail) : lines;
    return {
      sdkId: id,
      logPath,
      content: selected.join("\n").trimEnd(),
      truncated: lines.length > normalizedTail,
    };
  }

  async register(
    projectId: string,
    input: SdkRegistrationInput,
    requestId?: string,
  ): Promise<RegisteredSdk> {
    if (!input.files.length) {
      throw new InvalidInputError("SDK upload requires at least one file");
    }

    const sdkId = input.sdkId ?? `sdk-${crypto.randomUUID().slice(0, 8)}`;
    const sdkRoot = path.join(this.uploadsDir, projectId, "sdk", sdkId);
    const artifactKind: SdkArtifactKind = input.files.length > 1 ? "folder" : inferArtifactKind(input.files[0].originalName);
    const primaryFile = input.files[0];
    const canonicalPath = path.join(sdkRoot, artifactKind === "bin" ? "installed" : "content");
    const now = new Date().toISOString();

    const baseProfile: SdkAnalyzedProfile = {
      artifactKind,
      sdkVersion: inferVersion(input.name, ...input.files.map((file) => file.originalName)),
      targetSystem: inferTargetSystem(input.name, ...input.files.map((file) => file.originalName)),
    };

    const sdk: RegisteredSdk = {
      id: sdkId,
      projectId,
      name: input.name,
      description: input.description,
      path: canonicalPath,
      profile: baseProfile,
      artifactKind,
      sdkVersion: baseProfile.sdkVersion,
      targetSystem: baseProfile.targetSystem,
      status: "uploaded",
      verified: false,
      createdAt: now,
      updatedAt: now,
    };
    this.dao.save(sdk);
    const logCtx = this.createLogContext(projectId, sdkId);
    this.appendLifecycleLog(logCtx, "upload completed", { fileName: primaryFile.originalName, fileCount: input.files.length });
    this.broadcast(projectId, sdkId, "uploaded", "SDK 업로드 완료", { percent: 100, fileName: primaryFile.originalName });
    const emitTerminalNotification = this.createTerminalNotificationEmitter(projectId, sdkId);

      this.runPipeline(projectId, sdk, input.files, requestId).catch((err) => {
      const failure = err instanceof SdkPipelineFailure
        ? err
        : new SdkPipelineFailure("verify_failed", "verify_failed", err instanceof Error ? err.message : String(err));

      const existing = this.dao.findById(sdkId);
      if (existing?.profile) {
        this.dao.updateProfile(sdkId, mergeProfiles(existing.profile, { installLogPath: failure.logPath }));
      }
      this.dao.updateStatus(sdkId, failure.status, failure.message);
      this.sdkWs.broadcast(projectId, {
        type: "sdk-error",
        payload: { sdkId, phase: failure.phase, error: failure.message, logPath: failure.logPath },
      });
      const failureLogCtx = this.createLogContext(projectId, sdkId, failure.logPath);
      this.appendTerminalLog(failureLogCtx, "install failed", { phase: failure.phase, error: failure.message });
      emitTerminalNotification("sdk_failed", failure.message);
      logger.error({ err, sdkId, phase: failure.phase, logPath: failure.logPath }, "SDK registration pipeline failed");
    });

    return this.dao.findById(sdkId) ?? sdk;
  }

  async remove(id: string, _requestId?: string): Promise<void> {
    const sdk = this.dao.findById(id);
    if (!sdk) throw new NotFoundError(`SDK not found: ${id}`);

    if (sdk.path.startsWith(path.resolve(this.uploadsDir)) && fs.existsSync(path.join(this.uploadsDir, sdk.projectId, "sdk", id))) {
      fs.rmSync(path.join(this.uploadsDir, sdk.projectId, "sdk", id), { recursive: true, force: true });
    }

    this.dao.delete(id);
    logger.info({ sdkId: id }, "SDK removed");
  }

  private async runPipeline(
    projectId: string,
    sdk: RegisteredSdk,
    files: UploadedSdkFile[],
    requestId?: string,
  ): Promise<void> {
    const logCtx = this.createLogContext(projectId, sdk.id);
    const emitTerminalNotification = this.createTerminalNotificationEmitter(projectId, sdk.id);
    let profile = mergeProfiles(sdk.profile ?? {}, undefined);
    const materialized = profile.artifactKind === "bin"
      ? await this.installBinary(projectId, sdk.id, files[0])
      : profile.artifactKind === "folder"
        ? await this.materializeFolder(projectId, sdk.id, files)
        : await this.extractArchive(projectId, sdk.id, files[0]);

    if (materialized.path !== sdk.path) {
      this.dao.updatePath(sdk.id, materialized.path);
    }
    if (materialized.logPath) {
      profile = mergeProfiles(profile, { installLogPath: materialized.logPath });
      this.dao.updateProfile(sdk.id, profile);
    }

    this.dao.updateStatus(sdk.id, "analyzing");
    this.broadcast(projectId, sdk.id, "analyzing", "Build Agent가 SDK 구조 분석 중...");
    this.appendLifecycleLog(logCtx, "analysis started");

    try {
      const resp = await this.buildAgentClient.submitTask(
        {
          taskType: "sdk-analyze",
          taskId: `sdk-${sdk.id}`,
          context: { trusted: { projectPath: materialized.path } },
          constraints: { timeoutMs: 300_000 },
        },
        requestId,
      );

      if (this.buildAgentClient.isSuccess(resp)) {
        const analyzed = (resp.result as { sdkProfile?: SdkAnalyzedProfile }).sdkProfile ?? {};
        profile = mergeProfiles(profile, analyzed);
        if (!profile.targetSystem) {
          profile.targetSystem = analyzed.targetArch ?? inferTargetSystem(...files.map((file) => file.originalName));
        }
        this.dao.updateProfile(sdk.id, profile);
        logger.info({ sdkId: sdk.id, profile }, "SDK profile analyzed");
      } else {
        logger.warn({ sdkId: sdk.id }, "Build Agent SDK analysis failed — continuing with inferred metadata");
      }
    } catch (err) {
      logger.warn({ err, sdkId: sdk.id }, "Build Agent unavailable for SDK analysis — continuing");
    }

    this.dao.updateStatus(sdk.id, "verifying");
    this.broadcast(projectId, sdk.id, "verifying", "S2가 SDK 구조를 검증 중...");
    this.appendLifecycleLog(logCtx, "verification started");

    try {
      this.verifyMaterializedSdk(materialized.path, profile);
      this.dao.updateStatus(sdk.id, "ready");
      this.broadcast(projectId, sdk.id, "ready", "SDK 등록 완료");
      this.appendTerminalLog(this.createLogContext(projectId, sdk.id, materialized.logPath), "install completed", { path: materialized.path });
      this.sdkWs.broadcast(projectId, {
        type: "sdk-complete",
        payload: { sdkId: sdk.id, profile, path: materialized.path },
      });
      emitTerminalNotification("sdk_ready", "SDK 등록 완료");
    } catch (err) {
      if (err instanceof SdkPipelineFailure) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new SdkPipelineFailure("verify_failed", "verify_failed", msg, materialized.logPath);
    }
  }

  private async extractArchive(
    projectId: string,
    sdkId: string,
    file: UploadedSdkFile,
  ): Promise<MaterializedSdkResult> {
    const sdkRoot = path.join(this.uploadsDir, projectId, "sdk", sdkId);
    const contentDir = path.join(sdkRoot, "content");

    this.dao.updateStatus(sdkId, "extracting");
    this.broadcast(projectId, sdkId, "extracting", "SDK 압축 해제 중...", { fileName: file.originalName });

    const entries = await this.listArchiveEntries(file.storedPath, file.originalName);
    if (!entries.length) {
      throw new SdkPipelineFailure("extract_failed", "extract_failed", "Archive is empty");
    }
    const unsafe = entries.find((entry) => !isRelativeSafe(entry));
    if (unsafe) {
      throw new SdkPipelineFailure("extract_failed", "extract_failed", `Unsafe archive entry detected: ${unsafe}`);
    }

    fs.mkdirSync(contentDir, { recursive: true });
    try {
      if (file.originalName.toLowerCase().endsWith(".zip")) {
        await execFileAsync("unzip", ["-o", file.storedPath, "-d", contentDir]);
      } else {
        await execFileAsync("tar", ["-xf", file.storedPath, "-C", contentDir]);
      }
    } catch (err) {
      throw new SdkPipelineFailure("extract_failed", "extract_failed", err instanceof Error ? err.message : "Archive extraction failed");
    }

    this.ensureTreeWithinRoot(contentDir);
    const canonicalPath = this.selectCanonicalContentPath(contentDir);
    fs.rmSync(file.storedPath, { force: true });

    this.dao.updateStatus(sdkId, "extracted");
    this.broadcast(projectId, sdkId, "extracted", "SDK 압축 해제 완료");
    return { path: canonicalPath };
  }

  private async materializeFolder(
    projectId: string,
    sdkId: string,
    files: UploadedSdkFile[],
  ): Promise<MaterializedSdkResult> {
    const sdkRoot = path.join(this.uploadsDir, projectId, "sdk", sdkId);
    const contentDir = path.join(sdkRoot, "content");
    fs.mkdirSync(contentDir, { recursive: true });

    this.dao.updateStatus(sdkId, "extracting");
    this.broadcast(projectId, sdkId, "extracting", "SDK 폴더 업로드 정리 중...");

    for (const file of files) {
      const relativePath = sanitizeRelativePath(file.relativePath ?? file.originalName);
      const destination = path.join(contentDir, relativePath);
      const resolved = path.resolve(destination);
      if (!resolved.startsWith(path.resolve(contentDir))) {
        throw new SdkPipelineFailure("extract_failed", "extract_failed", `Folder path escaped project boundary: ${relativePath}`);
      }
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.renameSync(file.storedPath, resolved);
    }

    this.ensureTreeWithinRoot(contentDir);
    const canonicalPath = this.selectCanonicalContentPath(contentDir);
    this.dao.updateStatus(sdkId, "extracted");
    this.broadcast(projectId, sdkId, "extracted", "SDK 폴더 업로드 정리 완료");
    return { path: canonicalPath };
  }

  private async installBinary(
    projectId: string,
    sdkId: string,
    file: UploadedSdkFile,
  ): Promise<MaterializedSdkResult> {
    const sdkRoot = path.join(this.uploadsDir, projectId, "sdk", sdkId);
    const installRoot = path.join(sdkRoot, "installed");
    const logPath = buildSdkInstallLogPath(this.uploadsDir, projectId, sdkId);
    const homeDir = path.join(sdkRoot, ".home");
    const tmpDir = path.join(sdkRoot, ".tmp");
    const logCtx = this.createLogContext(projectId, sdkId, logPath);

    fs.mkdirSync(installRoot, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    this.dao.updateStatus(sdkId, "installing");
    this.broadcast(projectId, sdkId, "installing", "SDK 설치 파일 실행 중...", { fileName: file.originalName });
    this.appendLifecycleLog(logCtx, "install started", { fileName: file.originalName, installRoot });

    try {
      fs.chmodSync(file.storedPath, 0o755);
      await this.runInstaller(logCtx, file.storedPath, installRoot, homeDir, tmpDir);
    } catch (err) {
      throw new SdkPipelineFailure(
        "install_failed",
        "install_failed",
        err instanceof Error ? err.message : "Installer execution failed",
        logPath,
      );
    }

    this.ensureTreeWithinRoot(installRoot, { sanitizeExternalSymlinks: true });
    const canonicalPath = this.selectCanonicalContentPath(installRoot);
    fs.rmSync(file.storedPath, { force: true });

    this.dao.updateStatus(sdkId, "installed");
    this.broadcast(projectId, sdkId, "installed", "SDK 설치 완료");
    this.appendLifecycleLog(logCtx, "install materialization completed", { installedPath: canonicalPath });
    return { path: canonicalPath, logPath };
  }

  private async listArchiveEntries(archivePath: string, originalName: string): Promise<string[]> {
    try {
      const { stdout } = originalName.toLowerCase().endsWith(".zip")
        ? await execFileAsync("unzip", ["-Z1", archivePath])
        : await execFileAsync("tar", ["-tf", archivePath]);
      return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    } catch (err) {
      throw new SdkPipelineFailure("extract_failed", "extract_failed", err instanceof Error ? err.message : "Failed to inspect archive");
    }
  }

  private ensureTreeWithinRoot(root: string, options?: { sanitizeExternalSymlinks?: boolean }): void {
    const resolvedRoot = path.resolve(root);
    const stack = [resolvedRoot];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const entryPath = path.join(current, entry.name);
        const stat = fs.lstatSync(entryPath);

        if (stat.isSymbolicLink()) {
          const linkTarget = fs.readlinkSync(entryPath);
          const resolvedTarget = path.resolve(path.dirname(entryPath), linkTarget);
          if (!resolvedTarget.startsWith(resolvedRoot)) {
            if (options?.sanitizeExternalSymlinks) {
              fs.rmSync(entryPath, { force: true });
              logger.warn({ root: resolvedRoot, entry: entryPath, linkTarget }, "Removed SDK symlink that escaped project boundary");
              continue;
            }
            throw new SdkPipelineFailure("extract_failed", "extract_failed", `Path escaped project boundary: ${entry.name}`);
          }
          continue;
        }

        if (stat.isDirectory()) {
          stack.push(entryPath);
        }
      }
    }
  }

  private selectCanonicalContentPath(root: string): string {
    const entries = fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("."));
    if (entries.length === 1 && entries[0].isDirectory()) {
      return path.join(root, entries[0].name);
    }
    return root;
  }

  private verifyMaterializedSdk(rootPath: string, profile: SdkAnalyzedProfile): void {
    const resolvedRoot = path.resolve(rootPath);
    const uploadsRoot = path.resolve(this.uploadsDir);
    if (!resolvedRoot.startsWith(uploadsRoot)) {
      throw new SdkPipelineFailure("verify_failed", "verify_failed", "SDK path escaped uploads root");
    }
    if (!fs.existsSync(resolvedRoot)) {
      throw new SdkPipelineFailure("verify_failed", "verify_failed", "SDK path does not exist");
    }

    const visibleEntries = fs.readdirSync(resolvedRoot).filter((entry) => !entry.startsWith("."));
    if (visibleEntries.length === 0) {
      throw new SdkPipelineFailure("verify_failed", "verify_failed", "SDK content is empty");
    }

    const validateProfilePath = (candidate: string | undefined, fieldName: string): void => {
      if (!candidate) return;
      const normalized = candidate.replace(/\\/g, "/");
      const resolved = path.resolve(resolvedRoot, normalized);
      if (!resolved.startsWith(resolvedRoot)) {
        throw new SdkPipelineFailure("verify_failed", "verify_failed", `${fieldName} escaped SDK root`);
      }
      if (!fs.existsSync(resolved)) {
        throw new SdkPipelineFailure("verify_failed", "verify_failed", `${fieldName} not found: ${candidate}`);
      }
    };

    validateProfilePath(profile.environmentSetup, "environmentSetup");
    validateProfilePath(profile.sysroot, "sysroot");
    for (const includePath of profile.includePaths ?? []) {
      validateProfilePath(includePath, "includePath");
    }

    this.ensureTreeWithinRoot(resolvedRoot, { sanitizeExternalSymlinks: true });
  }

  private runInstaller(
    logCtx: SdkLogContext,
    installerPath: string,
    installRoot: string,
    homeDir: string,
    tmpDir: string,
  ): Promise<void> {
    return this.runInstallerWithRetry(logCtx, installerPath, installRoot, homeDir, tmpDir);
  }

  private async runInstallerWithRetry(
    logCtx: SdkLogContext,
    installerPath: string,
    installRoot: string,
    homeDir: string,
    tmpDir: string,
  ): Promise<void> {
    for (let attempt = 0; attempt <= ETXTBSY_RETRY_COUNT; attempt += 1) {
      try {
        await this.runInstallerOnce(logCtx, installerPath, installRoot, homeDir, tmpDir, attempt + 1);
        return;
      } catch (err) {
        if (!isTextFileBusyError(err) || attempt === ETXTBSY_RETRY_COUNT) {
          throw err;
        }

        logger.warn({
          installerPath,
          attempt: attempt + 1,
          retryInMs: ETXTBSY_RETRY_DELAY_MS,
        }, "Installer executable still busy after upload; retrying");
        this.appendLifecycleLog(logCtx, "installer retry scheduled", {
          attempt: attempt + 1,
          reason: "ETXTBSY",
          retryInMs: ETXTBSY_RETRY_DELAY_MS,
        });
        await delay(ETXTBSY_RETRY_DELAY_MS);
      }
    }
  }

  private runInstallerOnce(
    logCtx: SdkLogContext,
    installerPath: string,
    installRoot: string,
    homeDir: string,
    tmpDir: string,
    attempt: number,
    ): Promise<void> {
    return new Promise((resolve, reject) => {
      const installTimeoutMs = getInstallTimeoutMs();
      const installHeartbeatMs = getInstallHeartbeatMs();
      const stdoutCollector = createSdkOutputCollector(logCtx, "stdout");
      const stderrCollector = createSdkOutputCollector(logCtx, "stderr");
      let lastInstallerOutputAt: number | undefined;
      const child = spawn(installerPath, [
        "--mode",
        "unattended",
        "--unattendedmodeui",
        "none",
        "--prefix",
        installRoot,
      ], {
        cwd: path.dirname(installerPath),
        env: {
          ...process.env,
          HOME: homeDir,
          TMPDIR: tmpDir,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.appendLifecycleLog(logCtx, "installer process spawned", { attempt, pid: child.pid ?? "unknown" });

      const heartbeat = setInterval(() => {
        const lastOutputAgeMs = typeof lastInstallerOutputAt === "number"
          ? Math.max(0, Date.now() - lastInstallerOutputAt)
          : undefined;
        this.appendLifecycleLog(logCtx, "install heartbeat", {
          childAlive: !child.killed,
          attempt,
          lastOutputAgeMs: lastOutputAgeMs ?? "n/a",
        }, "heartbeat");
      }, installHeartbeatMs);

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        this.appendLifecycleLog(logCtx, "installer timeout reached", { attempt, timeoutMs: installTimeoutMs });
        reject(new Error(`Installer timed out after ${installTimeoutMs / 60000} minutes`));
      }, installTimeoutMs);

      child.stdout?.on("data", (chunk: Buffer | string) => {
        lastInstallerOutputAt = Date.now();
        stdoutCollector.push(chunk);
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        lastInstallerOutputAt = Date.now();
        stderrCollector.push(chunk);
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        clearInterval(heartbeat);
        stdoutCollector.flush();
        stderrCollector.flush();
        this.appendLifecycleLog(logCtx, "installer process error", { attempt, error: err.message });
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        clearInterval(heartbeat);
        stdoutCollector.flush();
        stderrCollector.flush();
        if (code === 0) {
          this.appendLifecycleLog(logCtx, "installer process exited successfully", { attempt, code: 0 });
          resolve();
          return;
        }
        this.appendLifecycleLog(logCtx, "installer process exited with failure", { attempt, code: code ?? "unknown" });
        reject(new Error(`Installer exited with code ${code ?? "unknown"}`));
      });
    });
  }

  private broadcast(
    projectId: string,
    sdkId: string,
    phase: SdkProgressPhase,
    message: string,
    extra?: { percent?: number; uploadedBytes?: number; totalBytes?: number; fileName?: string },
  ): void {
    this.sdkWs.broadcast(projectId, {
      type: "sdk-progress",
      payload: { sdkId, phase, message, ...extra },
    });
  }

  private emitTerminalNotification(
    projectId: string,
    sdkId: string,
    type: "sdk_ready" | "sdk_failed",
    detail: string,
  ): void {
    try {
      this.notificationService?.emit({
        projectId,
        type,
        title: type === "sdk_ready" ? "SDK 등록 완료" : "SDK 등록 실패",
        body: detail,
        jobKind: "sdk",
        resourceId: sdkId,
        correlationId: sdkId,
      });
    } catch {
      // notification failure must not affect the SDK pipeline
    }
  }

  private resolveInstallLogPath(sdk: RegisteredSdk): string {
    return sdk.installLogPath
      ?? sdk.profile?.installLogPath
      ?? buildSdkInstallLogPath(this.uploadsDir, sdk.projectId, sdk.id);
  }

  private createLogContext(projectId: string, sdkId: string, logPath?: string): SdkLogContext {
    return {
      projectId,
      sdkId,
      logPath: logPath ?? buildSdkInstallLogPath(this.uploadsDir, projectId, sdkId),
      sdkWs: this.sdkWs,
    };
  }

  private appendLifecycleLog(
    ctx: SdkLogContext,
    message: string,
    details?: Record<string, unknown>,
    kind: "lifecycle" | "heartbeat" = "lifecycle",
  ): void {
    const suffix = details && Object.keys(details).length > 0
      ? ` | ${Object.entries(details).map(([key, value]) => `${key}=${String(value)}`).join(" ")}`
      : "";
    appendSdkLogLine(ctx, {
      source: "aegis",
      kind,
      message: `${message}${suffix}`,
      mirrorToServiceLog: true,
    });
  }

  private appendTerminalLog(
    ctx: SdkLogContext,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    const suffix = details && Object.keys(details).length > 0
      ? ` | ${Object.entries(details).map(([key, value]) => `${key}=${String(value)}`).join(" ")}`
      : "";
    appendSdkLogLine(ctx, {
      source: "aegis",
      kind: "terminal",
      message: `${message}${suffix}`,
      mirrorToServiceLog: true,
    });
  }

  private createTerminalNotificationEmitter(
    projectId: string,
    sdkId: string,
  ): (type: "sdk_ready" | "sdk_failed", detail: string) => void {
    let emitted = false;
    return (type: "sdk_ready" | "sdk_failed", detail: string): void => {
      if (emitted) return;
      emitted = true;
      this.emitTerminalNotification(projectId, sdkId, type, detail);
    };
  }
}
