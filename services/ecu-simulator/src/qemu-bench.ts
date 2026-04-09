import fs from "fs";
import path from "path";

export type QemuRuntime = "linux-user";
export type QemuArchitecture = "armhf" | "aarch64";

export interface QemuBenchManifest {
  schemaVersion: 1;
  name: string;
  description?: string;
  workspaceRoot?: string;
  runtime: QemuRuntime;
  architecture: QemuArchitecture;
  build?: {
    source: string;
    outputBinary: string;
    cflags?: string[];
    linkFlags?: string[];
  };
  firmware: {
    binary: string;
    args?: string[];
    env?: Record<string, string>;
  };
  docker: {
    dockerfile: string;
    imageTag: string;
  };
  qemu?: {
    extraArgs?: string[];
  };
  probe?: {
    stdin?: string;
  };
  smoke?: {
    ecuName?: string;
    telemetryCanId?: string;
    cases?: Array<{
      requestId: string;
      canId: string;
      text: string;
    }>;
  };
}

export interface ResolvedQemuBenchManifest {
  manifestPath: string;
  manifestDir: string;
  workspaceRoot: string;
  dockerfilePath: string;
  buildSourcePath?: string;
  buildOutputPath?: string;
  firmwarePath: string;
  manifest: QemuBenchManifest;
}

export interface CommandSpec {
  env?: Record<string, string>;
  argv: string[];
}

const QEMU_BINARY_BY_ARCH: Record<QemuArchitecture, string> = {
  armhf: "qemu-arm-static",
  aarch64: "qemu-aarch64-static",
};

const CROSS_COMPILER_BY_ARCH: Record<QemuArchitecture, string> = {
  armhf: "arm-linux-gnueabihf-gcc",
  aarch64: "aarch64-linux-gnu-gcc",
};

export function readQemuBenchManifest(manifestPath: string): ResolvedQemuBenchManifest {
  const absoluteManifestPath = path.resolve(manifestPath);
  const manifestDir = path.dirname(absoluteManifestPath);
  const raw = fs.readFileSync(absoluteManifestPath, "utf-8");
  const manifest = JSON.parse(raw) as QemuBenchManifest;
  const workspaceRoot = path.resolve(manifestDir, manifest.workspaceRoot ?? "../..");
  const dockerfilePath = path.resolve(manifestDir, manifest.docker.dockerfile);
  const buildSourcePath = manifest.build
    ? path.resolve(manifestDir, manifest.build.source)
    : undefined;
  const buildOutputPath = manifest.build
    ? path.resolve(manifestDir, manifest.build.outputBinary)
    : undefined;
  const firmwarePath = path.resolve(manifestDir, manifest.firmware.binary);

  return {
    manifestPath: absoluteManifestPath,
    manifestDir,
    workspaceRoot,
    dockerfilePath,
    buildSourcePath,
    buildOutputPath,
    firmwarePath,
    manifest,
  };
}

export function validateQemuBenchManifest(resolved: ResolvedQemuBenchManifest): string[] {
  const errors: string[] = [];
  const { manifest } = resolved;

  if (manifest.schemaVersion !== 1) {
    errors.push(`Unsupported schemaVersion: ${String(manifest.schemaVersion)}`);
  }

  if (manifest.runtime !== "linux-user") {
    errors.push(`Unsupported runtime: ${manifest.runtime}`);
  }

  if (!QEMU_BINARY_BY_ARCH[manifest.architecture]) {
    errors.push(`Unsupported architecture: ${manifest.architecture}`);
  }

  if (!manifest.name.trim()) {
    errors.push("Manifest name must not be empty");
  }

  if (!fs.existsSync(resolved.workspaceRoot)) {
    errors.push(`workspaceRoot does not exist: ${resolved.workspaceRoot}`);
  }

  if (!fs.existsSync(resolved.dockerfilePath)) {
    errors.push(`dockerfile does not exist: ${resolved.dockerfilePath}`);
  }

  if (resolved.buildSourcePath && !fs.existsSync(resolved.buildSourcePath)) {
    errors.push(`build.source does not exist: ${resolved.buildSourcePath}`);
  }

  if (!manifest.firmware.binary.trim()) {
    errors.push("firmware.binary must not be empty");
  }

  if (!manifest.docker.imageTag.trim()) {
    errors.push("docker.imageTag must not be empty");
  }

  return errors;
}

export function createDockerBuildCommand(resolved: ResolvedQemuBenchManifest): CommandSpec {
  const { manifest, dockerfilePath, workspaceRoot } = resolved;
  return {
    argv: [
      "docker",
      "build",
      "-f",
      dockerfilePath,
      "-t",
      manifest.docker.imageTag,
      workspaceRoot,
    ],
  };
}

export function createDockerCompileCommand(
  resolved: ResolvedQemuBenchManifest
): CommandSpec | null {
  const { manifest, workspaceRoot, buildSourcePath, buildOutputPath } = resolved;

  if (!manifest.build || !buildSourcePath || !buildOutputPath) {
    return null;
  }

  const compiler = CROSS_COMPILER_BY_ARCH[manifest.architecture];
  const sourceInWorkspace = toWorkspacePath(workspaceRoot, buildSourcePath);
  const outputInWorkspace = toWorkspacePath(workspaceRoot, buildOutputPath);

  return {
    argv: [
      "docker",
      "run",
      "--rm",
      "-v",
      `${workspaceRoot}:/workspace`,
      "-w",
      "/workspace",
      manifest.docker.imageTag,
      compiler,
      ...(manifest.build.cflags ?? []),
      ...(manifest.build.linkFlags ?? []),
      "-o",
      outputInWorkspace,
      sourceInWorkspace,
    ],
  };
}

export function createDockerRunCommand(resolved: ResolvedQemuBenchManifest): CommandSpec {
  const { manifest, workspaceRoot, firmwarePath } = resolved;
  const firmwareInWorkspace = toWorkspacePath(workspaceRoot, firmwarePath);
  const qemuBinary = QEMU_BINARY_BY_ARCH[manifest.architecture];

  return {
    argv: [
      "docker",
      "run",
      "--rm",
      "-i",
      "-v",
      `${workspaceRoot}:/workspace`,
      "-w",
      "/workspace",
      ...envArgs(manifest.firmware.env),
      manifest.docker.imageTag,
      qemuBinary,
      ...(manifest.qemu?.extraArgs ?? []),
      firmwareInWorkspace,
      ...(manifest.firmware.args ?? []),
    ],
  };
}

export function createHostCompileCommand(
  resolved: ResolvedQemuBenchManifest
): CommandSpec | null {
  const commands = createHostCompileCommands(resolved);

  if (!commands || commands.length === 0) {
    return null;
  }

  if (commands.length === 1) {
    return commands[0];
  }

  return {
    argv: [
      "bash",
      "-lc",
      commands.map(renderCommand).join(" && "),
    ],
  };
}

export function createHostCompileCommands(
  resolved: ResolvedQemuBenchManifest
): CommandSpec[] | null {
  const { manifest, buildSourcePath, buildOutputPath } = resolved;

  if (!manifest.build || !buildSourcePath || !buildOutputPath) {
    return null;
  }

  const crossCompiler = CROSS_COMPILER_BY_ARCH[manifest.architecture];
  if (commandExists(crossCompiler)) {
    return [{
      argv: [
        crossCompiler,
        ...(manifest.build.cflags ?? []),
        ...(manifest.build.linkFlags ?? []),
        "-o",
        buildOutputPath,
        buildSourcePath,
      ],
    }];
  }

  const fallback = createClangRustLldFallback(resolved);
  if (fallback) {
    return fallback;
  }

  return null;
}

export function createHostRunCommand(resolved: ResolvedQemuBenchManifest): CommandSpec {
  const { manifest, firmwarePath } = resolved;

  return {
    env: manifest.firmware.env,
    argv: [
      QEMU_BINARY_BY_ARCH[manifest.architecture],
      ...(manifest.qemu?.extraArgs ?? []),
      firmwarePath,
      ...(manifest.firmware.args ?? []),
    ],
  };
}

export function createHostProbeInput(resolved: ResolvedQemuBenchManifest): string | undefined {
  return resolved.manifest.probe?.stdin;
}

export function getSmokeConfig(resolved: ResolvedQemuBenchManifest): {
  ecuName: string;
  telemetryCanId: string;
  cases: Array<{ requestId: string; canId: string; text: string }>;
} {
  return {
    ecuName: resolved.manifest.smoke?.ecuName ?? "QEMU_SMOKE",
    telemetryCanId: resolved.manifest.smoke?.telemetryCanId ?? "0x700",
    cases: resolved.manifest.smoke?.cases ?? [
      { requestId: "req-1", canId: "0x123", text: "hello" },
      { requestId: "req-2", canId: "0x124", text: "exit" },
    ],
  };
}

export function getQemuBinaryName(architecture: QemuArchitecture): string {
  return QEMU_BINARY_BY_ARCH[architecture];
}

export function renderCommand(command: CommandSpec): string {
  const envPrefix = Object.entries(command.env ?? {})
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");
  const argv = command.argv.map(shellQuote).join(" ");
  return envPrefix ? `${envPrefix} ${argv}` : argv;
}

function envArgs(env?: Record<string, string>): string[] {
  if (!env) return [];
  return Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
}

function commandExists(commandName: string): boolean {
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter);
  return pathEntries.some((entry) => fs.existsSync(path.join(entry, commandName)));
}

function createClangRustLldFallback(
  resolved: ResolvedQemuBenchManifest
): CommandSpec[] | null {
  const { manifest, buildSourcePath, buildOutputPath } = resolved;
  const rustLld = findRustLld();

  if (!buildSourcePath || !buildOutputPath || !rustLld || !commandExists("clang-18")) {
    return null;
  }

  const objectPath = `${buildOutputPath}.o`;
  const targetTriple = manifest.architecture === "armhf"
    ? "arm-linux-gnueabihf"
    : "aarch64-linux-gnu";
  const linkerEmulation = manifest.architecture === "armhf"
    ? "armelf_linux_eabi"
    : "aarch64linux";

  return [
    {
      argv: [
        "clang-18",
        `--target=${targetTriple}`,
        ...(manifest.build?.cflags ?? []),
        "-c",
        "-o",
        objectPath,
        buildSourcePath,
      ],
    },
    {
      argv: [
        rustLld,
        "-flavor",
        "gnu",
        "-m",
        linkerEmulation,
        "-static",
        "-e",
        "_start",
        "-o",
        buildOutputPath,
        objectPath,
      ],
    },
  ];
}

function findRustLld(): string | null {
  const home = process.env.HOME;

  if (!home) {
    return null;
  }

  const stablePath = path.join(
    home,
    ".rustup",
    "toolchains",
    "stable-x86_64-unknown-linux-gnu",
    "lib",
    "rustlib",
    "x86_64-unknown-linux-gnu",
    "bin",
    "rust-lld"
  );

  return fs.existsSync(stablePath) ? stablePath : null;
}

function toWorkspacePath(workspaceRoot: string, absolutePath: string): string {
  const relativePath = path.relative(workspaceRoot, absolutePath);

  if (relativePath.startsWith("..")) {
    throw new Error(`Path escapes workspaceRoot: ${absolutePath}`);
  }

  return path.posix.join("/workspace", ...relativePath.split(path.sep));
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
