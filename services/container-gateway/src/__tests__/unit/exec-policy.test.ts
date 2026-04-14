import { describe, expect, it } from "vitest";
import { ensureAllowedCommand, ensureSafeExecArgs, getAllowedCommands } from "../../services/exec-policy";

describe("exec policy", () => {
  it("allows read-only/build commands", () => {
    expect(() => ensureAllowedCommand("ls")).not.toThrow();
    expect(() => ensureAllowedCommand("cp")).not.toThrow();
    expect(() => ensureAllowedCommand("mv")).not.toThrow();
    expect(() => ensureAllowedCommand("gcc")).not.toThrow();
    expect(getAllowedCommands()).toContain("pwd");
  });

  it("rejects unrestricted shell commands", () => {
    expect(() => ensureAllowedCommand("bash")).toThrow("Command not allowed");
    expect(() => ensureAllowedCommand("rm")).toThrow("Command not allowed");
  });

  it("rejects absolute and parent-traversal paths for filesystem commands", () => {
    expect(() => ensureSafeExecArgs("cp", ["../../etc/passwd", "copy.txt"])).toThrow("Parent traversal is not allowed");
    expect(() => ensureSafeExecArgs("mv", ["/tmp/file", "here"])).toThrow("Absolute paths are not allowed");
  });

  it("allows relative filesystem arguments inside the workspace", () => {
    expect(() => ensureSafeExecArgs("cp", ["src/main.c", "backup/main.c"])).not.toThrow();
    expect(() => ensureSafeExecArgs("mkdir", ["-p", "build/out"])).not.toThrow();
  });
});
