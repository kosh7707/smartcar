import path from "path";
import { describe, expect, it } from "vitest";
import {
  createDockerBuildCommand,
  createDockerCompileCommand,
  createHostProbeInput,
  createDockerRunCommand,
  createHostCompileCommand,
  createHostRunCommand,
  getSmokeConfig,
  readQemuBenchManifest,
  renderCommand,
  validateQemuBenchManifest,
} from "../../qemu-bench";

const sampleManifestPath = path.resolve(
  __dirname,
  "../../../qemu/manifests/sample-armhf-user.json"
);

describe("QEMU bench manifest", () => {
  it("loads and validates the sample manifest", () => {
    const resolved = readQemuBenchManifest(sampleManifestPath);
    expect(validateQemuBenchManifest(resolved)).toEqual([]);
    expect(resolved.manifest.architecture).toBe("armhf");
    expect(resolved.firmwarePath.endsWith("qemu/out/sample-ecu-armhf")).toBe(true);
  });

  it("renders host compile and run commands", () => {
    const resolved = readQemuBenchManifest(sampleManifestPath);
    const compile = createHostCompileCommand(resolved);
    const run = createHostRunCommand(resolved);
    const compileText = renderCommand(compile!);

    expect(compile).not.toBeNull();
    expect(compileText).toContain("sample-ecu.c");
    expect(
      compileText.includes("arm-linux-gnueabihf-gcc") ||
      compileText.includes("clang-18")
    ).toBe(true);
    expect(renderCommand(run)).toContain("qemu-arm-static");
    expect(renderCommand(run)).toContain("AegisSampleECU");
  });

  it("renders docker build, compile, and run commands", () => {
    const resolved = readQemuBenchManifest(sampleManifestPath);
    const build = createDockerBuildCommand(resolved);
    const compile = createDockerCompileCommand(resolved);
    const run = createDockerRunCommand(resolved);

    expect(renderCommand(build)).toContain("docker build");
    expect(renderCommand(build)).toContain("toolchain.Dockerfile");
    expect(compile).not.toBeNull();
    expect(renderCommand(compile!)).toContain("/workspace/qemu/out/sample-ecu-armhf");
    expect(renderCommand(run)).toContain("docker run");
    expect(renderCommand(run)).toContain("qemu-arm-static");
    expect(renderCommand(run)).toContain("ECU_SAMPLE_MODE=demo");
  });

  it("exposes probe stdin for the sample manifest", () => {
    const resolved = readQemuBenchManifest(sampleManifestPath);
    expect(createHostProbeInput(resolved)).toContain("exit");
  });

  it("exposes manifest-driven smoke defaults", () => {
    const resolved = readQemuBenchManifest(sampleManifestPath);
    const smoke = getSmokeConfig(resolved);
    expect(smoke.ecuName).toBe("QEMU_SAMPLE_MANIFEST");
    expect(smoke.telemetryCanId).toBe("0x700");
    expect(smoke.cases.map((item) => item.requestId)).toEqual(["req-hello", "req-exit"]);
  });
});
