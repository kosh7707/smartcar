const ALLOWED_COMMANDS = new Set([
  "pwd",
  "ls",
  "find",
  "file",
  "cat",
  "cp",
  "mv",
  "mkdir",
  "gcc",
  "g++",
  "make",
  "readelf",
  "objdump",
  "arm-linux-gnueabihf-gcc",
  "aarch64-linux-gnu-gcc",
]);

export function ensureAllowedCommand(command: string): void {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }
}

export function getAllowedCommands(): string[] {
  return [...ALLOWED_COMMANDS].sort();
}

const PATH_SENSITIVE_COMMANDS = new Set(["ls", "find", "file", "cat", "cp", "mv", "mkdir"]);

export function ensureSafeExecArgs(command: string, args: string[]): void {
  if (!PATH_SENSITIVE_COMMANDS.has(command)) return;

  for (const arg of args) {
    if (arg.startsWith("-")) continue;
    if (arg === "." || arg === "./") continue;
    if (arg.startsWith("/")) {
      throw new Error(`Absolute paths are not allowed for command: ${command}`);
    }
    const normalized = arg.replace(/\\/g, "/");
    if (normalized.split("/").includes("..")) {
      throw new Error(`Parent traversal is not allowed for command: ${command}`);
    }
  }
}
