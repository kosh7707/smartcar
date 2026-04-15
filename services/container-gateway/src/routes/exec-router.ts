import { Router } from "express";
import type { ExecRequest } from "../contracts/exec-contract";
import { ContainerExecutor } from "../services/container-executor";
import { asyncHandler } from "../utils/async-handler";
import { assertProjectId } from "../utils/project-id";
import { getAllowedCommands } from "../services/exec-policy";

export function createExecRouter(executor: ContainerExecutor): Router {
  const router = Router({ mergeParams: true });

  router.get("/exec/allowed-commands", (_req, res) => {
    res.json({
      success: true,
      data: {
        commands: getAllowedCommands(),
        note: "S8 v1 exec is allowlist-based and limited to read-only/build-oriented commands.",
      },
    });
  });

  router.post("/exec", asyncHandler(async (req, res) => {
    try {
      assertProjectId(req.params.projectId as string);
    } catch {
      res.status(400).json({ success: false, error: "Invalid projectId" });
      return;
    }

    const body = req.body as Partial<ExecRequest>;
    if (!body.workspaceId) {
      res.status(400).json({ success: false, error: "workspaceId is required" });
      return;
    }
    if (!body.command?.trim()) {
      res.status(400).json({ success: false, error: "command is required" });
      return;
    }

    try {
      const result = await executor.execute(
        req.params.projectId as string,
        body as ExecRequest
      );
      res.status(result.success ? 200 : 422).json({ success: true, data: result });
    } catch (error: any) {
      const message = error?.message ?? "exec failed";
      const disallowed = /Command not allowed:/i.test(message);
      const dockerUnavailable = /docker .*could not be found|Command failed: docker/i.test(message);
      const status = disallowed ? 400 : dockerUnavailable ? 503 : 500;
      res.status(status).json({
        success: false,
        error: message,
        errorDetail: {
          code: disallowed
            ? "COMMAND_NOT_ALLOWED"
            : dockerUnavailable
              ? "CONTAINER_RUNTIME_UNAVAILABLE"
              : "EXEC_FAILED",
          projectId: req.params.projectId as string,
          workspaceId: body.workspaceId,
          command: body.command,
          args: body.args ?? [],
          retryable: dockerUnavailable,
        },
      });
    }
  }));

  return router;
}
