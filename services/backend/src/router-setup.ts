/**
 * Router Setup — 모든 Express 라우터 마운트
 */
import type { Express } from "express";
import type { AppContext } from "./composition";

import { createHealthRouter } from "./controllers/health.controller";
import { createProjectRouter } from "./controllers/project.controller";
import { createFileRouter } from "./controllers/file.controller";
import { createDynamicAnalysisRouter } from "./controllers/dynamic-analysis.controller";
import { createProjectAdaptersRouter } from "./controllers/project-adapters.controller";
import { createProjectSettingsRouter, createSdkProfileRouter } from "./controllers/project-settings.controller";
import { createDynamicTestRouter } from "./controllers/dynamic-test.controller";
import { createRunRouter, createRunDetailRouter } from "./controllers/run.controller";
import { createFindingRouter, createFindingDetailRouter } from "./controllers/finding.controller";
import { createQualityGateRouter, createQualityGateDetailRouter } from "./controllers/quality-gate.controller";
import { createApprovalRouter, createApprovalDetailRouter } from "./controllers/approval.controller";
import { createReportRouter } from "./controllers/report.controller";
import { createAnalysisRouter } from "./controllers/analysis.controller";
import { createProjectSourceRouter } from "./controllers/project-source.controller";
import { createBuildTargetRouter } from "./controllers/build-target.controller";
import { createPipelineRouter } from "./controllers/pipeline.controller";
import { createTargetLibraryRouter } from "./controllers/target-library.controller";
import { createSdkRouter } from "./controllers/sdk.controller";
import { createActivityRouter } from "./controllers/activity.controller";

export function mountRouters(app: Express, ctx: AppContext): void {
  // 프로젝트 스코프 라우터
  app.use("/api/projects/:pid/adapters", createProjectAdaptersRouter(ctx.adapterManager));
  app.use("/api/projects/:pid/settings", createProjectSettingsRouter(ctx.settingsService));
  app.use("/api/projects/:pid/runs", createRunRouter(ctx.runService));
  app.use("/api/projects/:pid/findings", createFindingRouter(ctx.findingService));
  app.use("/api/projects/:pid/gates", createQualityGateRouter(ctx.qualityGateService));
  app.use("/api/projects/:pid/approvals", createApprovalRouter(ctx.approvalService));
  app.use("/api/projects/:pid/report", createReportRouter(ctx.reportService));
  app.use("/api/projects/:pid/activity", createActivityRouter(ctx.activityService));

  // 글로벌 라우터
  app.use("/api/sdk-profiles", createSdkProfileRouter());
  app.use("/health", createHealthRouter(ctx.llmAdapter, ctx.adapterManager, ctx.agentClient, ctx.sastClient, ctx.kbClient, ctx.buildAgentClient));
  app.use("/api/projects", createProjectRouter(ctx.projectService));
  app.use("/api", createFileRouter(ctx.fileStore));
  app.use("/api/dynamic-analysis", createDynamicAnalysisRouter(ctx.dynamicAnalysisService));
  app.use("/api/dynamic-test", createDynamicTestRouter(ctx.dynamicTestService));
  app.use("/api/analysis", createAnalysisRouter(
    ctx.analysisOrchestrator, ctx.analysisResultDAO, ctx.analysisTracker,
    ctx.findingDAO, ctx.runDAO, ctx.gateResultDAO, ctx.agentClient, ctx.projectSourceService,
  ));
  app.use("/api/projects/:pid/source", createProjectSourceRouter(ctx.projectSourceService, ctx.projectDAO, ctx.uploadWs, ctx.buildTargetDAO));
  app.use("/api/projects/:pid/targets", createBuildTargetRouter(ctx.buildTargetService, ctx.projectDAO, ctx.projectSourceService, ctx.sastClient));
  app.use("/api/projects/:pid/targets/:tid/libraries", createTargetLibraryRouter(ctx.targetLibraryDAO, ctx.buildTargetDAO, ctx.projectDAO));
  app.use("/api/projects/:pid/sdk", createSdkRouter(ctx.sdkService, ctx.projectDAO));
  app.use("/api/projects/:pid/pipeline", createPipelineRouter(ctx.pipelineOrchestrator, ctx.projectDAO, ctx.buildTargetDAO));
  app.use("/api/runs", createRunDetailRouter(ctx.runService));
  app.use("/api/findings", createFindingDetailRouter(ctx.findingService));
  app.use("/api/gates", createQualityGateDetailRouter(ctx.qualityGateService, ctx.approvalService));
  app.use("/api/approvals", createApprovalDetailRouter(ctx.approvalService));
}
