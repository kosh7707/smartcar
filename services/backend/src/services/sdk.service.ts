import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { RegisteredSdk, SdkProfile, SdkAnalyzedProfile } from "@aegis/shared";
import type { SdkRegistryDAO } from "../dao/sdk-registry.dao";
import type { SastClient } from "./sast-client";
import type { BuildAgentClient } from "./build-agent-client";
import type { WsBroadcaster } from "./ws-broadcaster";
import { SDK_PROFILES } from "./sdk-profiles";
import { createLogger } from "../lib/logger";
import { NotFoundError, InvalidInputError } from "../lib/errors";

const logger = createLogger("sdk-service");

export interface SdkRegistrationInput {
  name: string;
  description?: string;
  /** 로컬 경로 (파일 업로드 대신 직접 지정) */
  localPath?: string;
}

export class SdkService {
  constructor(
    private dao: SdkRegistryDAO,
    private sastClient: SastClient,
    private buildAgentClient: BuildAgentClient,
    private uploadsDir: string,
    private sdkWs: WsBroadcaster<any>,
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

  /**
   * SDK 등록 파이프라인 (비동기)
   *
   * 1. uploading → 파일 저장 (또는 localPath 검증)
   * 2. extracting → 압축 해제
   * 3. analyzing → S3 Build Agent sdk-analyze → profile 자동 채움
   * 4. verifying → S4 POST /v1/sdk-registry → 검증
   * 5. ready 또는 verify_failed
   */
  async register(
    projectId: string,
    input: SdkRegistrationInput,
    file?: Buffer,
    requestId?: string,
  ): Promise<RegisteredSdk> {
    const sdkId = `sdk-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    // SDK 경로 결정
    let sdkPath: string;
    if (input.localPath) {
      // 로컬 경로 직접 지정
      if (!fs.existsSync(input.localPath)) {
        throw new InvalidInputError(`SDK path not found: ${input.localPath}`);
      }
      sdkPath = input.localPath;
    } else if (file) {
      // 파일 업로드 → /uploads/{pid}/sdk/{sdkId}/
      sdkPath = path.join(this.uploadsDir, projectId, "sdk", sdkId);
      fs.mkdirSync(sdkPath, { recursive: true });
    } else {
      throw new InvalidInputError("SDK file or localPath is required");
    }

    // DB에 초기 레코드 저장
    const sdk: RegisteredSdk = {
      id: sdkId,
      projectId,
      name: input.name,
      description: input.description,
      path: sdkPath,
      status: "uploading",
      verified: false,
      createdAt: now,
      updatedAt: now,
    };
    this.dao.save(sdk);
    this.broadcast(projectId, sdkId, "uploading", "SDK 등록 시작...");

    // 비동기 파이프라인 실행 (응답은 즉시 반환)
    this.runPipeline(projectId, sdkId, sdkPath, file, requestId).catch((err) => {
      logger.error({ err, sdkId }, "SDK registration pipeline failed");
      this.dao.updateStatus(sdkId, "verify_failed", err instanceof Error ? err.message : String(err));
      this.sdkWs.broadcast(projectId, {
        type: "sdk-error",
        payload: { sdkId, error: err instanceof Error ? err.message : String(err) },
      });
    });

    return sdk;
  }

  async remove(id: string, requestId?: string): Promise<void> {
    const sdk = this.dao.findById(id);
    if (!sdk) throw new NotFoundError(`SDK not found: ${id}`);

    // S4에 등록 해제 요청
    try {
      await this.sastClient.deleteSdk(id, requestId);
    } catch (err) {
      logger.warn({ err, sdkId: id }, "S4 SDK deletion failed — continuing local cleanup");
    }

    // 파일 삭제 (uploads 내 경로인 경우만)
    if (sdk.path.includes("/sdk/") && fs.existsSync(sdk.path)) {
      fs.rmSync(sdk.path, { recursive: true, force: true });
    }

    this.dao.delete(id);
    logger.info({ sdkId: id }, "SDK removed");
  }

  private async runPipeline(
    projectId: string,
    sdkId: string,
    sdkPath: string,
    file?: Buffer,
    requestId?: string,
  ): Promise<void> {
    // ── Step 1: Extract ──
    if (file) {
      this.dao.updateStatus(sdkId, "extracting");
      this.broadcast(projectId, sdkId, "extracting", "SDK 압축 해제 중...");

      // tar.gz 또는 zip 해제
      const tmpFile = path.join(sdkPath, "__sdk-upload.tar.gz");
      fs.writeFileSync(tmpFile, file);
      const { execSync } = await import("child_process");
      try {
        execSync(`tar -xzf "${tmpFile}" -C "${sdkPath}" 2>/dev/null || unzip -o "${tmpFile}" -d "${sdkPath}" 2>/dev/null`, {
          timeout: 120_000,
        });
      } finally {
        fs.rmSync(tmpFile, { force: true });
      }
    } else {
      this.dao.updateStatus(sdkId, "extracting");
      this.broadcast(projectId, sdkId, "extracting", "로컬 경로 확인 완료");
    }

    // ── Step 2: Analyze (S3 Build Agent) ──
    this.dao.updateStatus(sdkId, "analyzing");
    this.broadcast(projectId, sdkId, "analyzing", "Build Agent가 SDK 구조 분석 중...");

    let profile: SdkAnalyzedProfile = {};
    try {
      const resp = await this.buildAgentClient.submitTask(
        {
          taskType: "sdk-analyze" as any,
          taskId: `sdk-${sdkId}`,
          context: { trusted: { projectPath: sdkPath } },
          constraints: { timeoutMs: 300_000 },
        },
        requestId,
      );

      if (this.buildAgentClient.isSuccess(resp)) {
        profile = (resp.result as any).sdkProfile ?? {};
        this.dao.updateProfile(sdkId, profile);
        logger.info({ sdkId, profile }, "SDK profile analyzed");
      } else {
        logger.warn({ sdkId }, "Build Agent SDK analysis failed — continuing with empty profile");
      }
    } catch (err) {
      logger.warn({ err, sdkId }, "Build Agent unavailable for SDK analysis — continuing");
    }

    // ── Step 3: Verify (S4) ──
    this.dao.updateStatus(sdkId, "verifying");
    this.broadcast(projectId, sdkId, "verifying", "SAST Runner가 SDK 검증 중...");

    try {
      const verifyResult = await this.sastClient.registerSdk(
        {
          sdkId,
          description: `${sdkId}`,
          path: sdkPath,
          sysroot: profile.sysroot,
          compilerPrefix: profile.compilerPrefix,
          gccVersion: profile.gccVersion,
          environmentSetup: profile.environmentSetup,
        },
        requestId,
      );

      if (verifyResult.success) {
        this.dao.updateStatus(sdkId, "ready");
        this.broadcast(projectId, sdkId, "ready", "SDK 등록 완료");
        this.sdkWs.broadcast(projectId, {
          type: "sdk-complete",
          payload: { sdkId, profile },
        });
      } else {
        const errorDetail = verifyResult.errors?.join(", ") ?? "Unknown verification error";
        this.dao.updateStatus(sdkId, "verify_failed", errorDetail);
        this.sdkWs.broadcast(projectId, {
          type: "sdk-error",
          payload: { sdkId, error: errorDetail },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.dao.updateStatus(sdkId, "verify_failed", msg);
      this.sdkWs.broadcast(projectId, {
        type: "sdk-error",
        payload: { sdkId, error: msg },
      });
    }
  }

  private broadcast(projectId: string, sdkId: string, phase: string, message: string): void {
    this.sdkWs.broadcast(projectId, {
      type: "sdk-progress",
      payload: { sdkId, phase, message },
    });
  }
}
