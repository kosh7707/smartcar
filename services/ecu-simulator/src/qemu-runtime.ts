import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawn, spawnSync, type ChildProcessWithoutNullStreams } from "child_process";
import {
  createHostCompileCommands,
  createHostProbeInput,
  createHostRunCommand,
  getQemuBinaryName,
  readQemuBenchManifest,
  renderCommand,
  validateQemuBenchManifest,
  type CommandSpec,
  type ResolvedQemuBenchManifest,
} from "./qemu-bench";

export { createHostCompileCommands, renderCommand } from "./qemu-bench";

export function resolveManifestOrThrow(manifestPath: string): ResolvedQemuBenchManifest {
  const resolved = readQemuBenchManifest(manifestPath);
  const errors = validateQemuBenchManifest(resolved);

  if (errors.length > 0) {
    throw new Error(
      [
        "QEMU manifest validation failed:",
        ...errors.map((error) => `- ${error}`),
      ].join("\n")
    );
  }

  return resolved;
}

export function ensureHostCompiled(resolved: ResolvedQemuBenchManifest): void {
  const compileCommands = createHostCompileCommands(resolved);

  if (!compileCommands || compileCommands.length === 0) {
    throw new Error("No host compile path is available for this manifest.");
  }

  fs.mkdirSync(path.dirname(resolved.firmwarePath), { recursive: true });

  for (const commandSpec of compileCommands) {
    runCommand(commandSpec);
  }
}

export function resolveQemuBinaryForManifest(
  resolved: ResolvedQemuBenchManifest
): string {
  return resolveQemuBinary(getQemuBinaryName(resolved.manifest.architecture));
}

export function createResolvedHostRunCommand(
  resolved: ResolvedQemuBenchManifest
): CommandSpec {
  const runCommandSpec = createHostRunCommand(resolved);
  const qemuPath = resolveQemuBinaryForManifest(resolved);

  return {
    ...runCommandSpec,
    argv: [qemuPath, ...runCommandSpec.argv.slice(1)],
  };
}

export function runHostProbe(resolved: ResolvedQemuBenchManifest): string {
  ensureHostCompiled(resolved);
  return runCommand(
    createResolvedHostRunCommand(resolved),
    createHostProbeInput(resolved)
  );
}

export function spawnHostFirmware(
  resolved: ResolvedQemuBenchManifest
): ChildProcessWithoutNullStreams {
  ensureHostCompiled(resolved);

  const runCommandSpec = createResolvedHostRunCommand(resolved);
  const child = spawn(runCommandSpec.argv[0], runCommandSpec.argv.slice(1), {
    env: { ...process.env, ...(runCommandSpec.env ?? {}) },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

export function resolveQemuBinary(binaryName: string): string {
  const pathFromEnv = execFileSync("bash", ["-lc", `command -v ${binaryName} || true`], {
    encoding: "utf-8",
  }).trim();

  if (pathFromEnv) {
    return pathFromEnv;
  }

  const toolRoot = path.join(os.tmpdir(), "aegis-s6-qemu-user-static");
  const extractedBinary = path.join(toolRoot, "usr", "bin", binaryName);

  if (fs.existsSync(extractedBinary)) {
    return extractedBinary;
  }

  fs.mkdirSync(toolRoot, { recursive: true });
  execFileSync(
    "bash",
    [
      "-lc",
      [
        "set -euo pipefail",
        "workdir=$(mktemp -d)",
        "cd \"$workdir\"",
        "apt download qemu-user-static >/dev/null 2>&1",
        "deb=$(ls qemu-user-static_*.deb | head -n1)",
        `rm -rf ${shellQuote(toolRoot)}`,
        `mkdir -p ${shellQuote(toolRoot)}`,
        `dpkg-deb -x \"$deb\" ${shellQuote(toolRoot)}`,
      ].join("; "),
    ],
    { stdio: "inherit" }
  );

  if (!fs.existsSync(extractedBinary)) {
    throw new Error(`Failed to stage ${binaryName}`);
  }

  return extractedBinary;
}

export function runCommand(commandSpec: CommandSpec, input?: string): string {
  const result = spawnSync(commandSpec.argv[0], commandSpec.argv.slice(1), {
    input,
    env: { ...process.env, ...(commandSpec.env ?? {}) },
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${renderCommand(commandSpec)}`,
        result.stdout ?? "",
        result.stderr ?? "",
      ].filter(Boolean).join("\n")
    );
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result.stdout ?? "";
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
