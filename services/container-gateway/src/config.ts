import path from "path";

export const config = Object.freeze({
  port: Number(process.env.PORT) || 4010,
  logDir: process.env.LOG_DIR ?? path.resolve(__dirname, "../../../logs"),
  runtimeDir: process.env.S8_RUNTIME_DIR ?? path.resolve(__dirname, "../.runtime"),
  uploadsDir: process.env.S8_UPLOADS_DIR ?? path.resolve(__dirname, "../uploads"),
  defaultImage: process.env.S8_IMAGE ?? "aegis-s8-qemu-compile:latest",
  workspaceMountDir: process.env.S8_WORKSPACE_DIR ?? "/workspace",
});
