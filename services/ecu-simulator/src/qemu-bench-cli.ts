import {
  createDockerBuildCommand,
  createDockerCompileCommand,
  createDockerRunCommand,
  createHostCompileCommand,
  createHostRunCommand,
  readQemuBenchManifest,
  renderCommand,
  validateQemuBenchManifest,
} from "./qemu-bench";

function main(): void {
  const [, , command, manifestPath] = process.argv;

  if (command !== "plan" || !manifestPath) {
    printUsageAndExit();
  }

  const resolved = readQemuBenchManifest(manifestPath);
  const errors = validateQemuBenchManifest(resolved);

  if (errors.length > 0) {
    console.error("QEMU bench manifest validation failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`# QEMU bench plan: ${resolved.manifest.name}`);
  if (resolved.manifest.description) {
    console.log(resolved.manifest.description);
  }
  console.log("");
  console.log(`manifest: ${resolved.manifestPath}`);
  console.log(`workspaceRoot: ${resolved.workspaceRoot}`);
  console.log(`dockerfile: ${resolved.dockerfilePath}`);
  console.log(`firmware: ${resolved.firmwarePath}`);

  const hostCompile = createHostCompileCommand(resolved);
  const hostRun = createHostRunCommand(resolved);
  const dockerBuild = createDockerBuildCommand(resolved);
  const dockerCompile = createDockerCompileCommand(resolved);
  const dockerRun = createDockerRunCommand(resolved);

  console.log("");
  console.log("## Host flow");
  if (hostCompile) {
    console.log(renderCommand(hostCompile));
  } else {
    console.log("# no host compile step declared");
  }
  console.log(renderCommand(hostRun));

  console.log("");
  console.log("## Docker flow");
  console.log(renderCommand(dockerBuild));
  if (dockerCompile) {
    console.log(renderCommand(dockerCompile));
  } else {
    console.log("# no docker compile step declared");
  }
  console.log(renderCommand(dockerRun));
}

function printUsageAndExit(): never {
  console.error(
    "Usage: tsx src/qemu-bench-cli.ts plan <manifest-path>"
  );
  process.exit(1);
}

main();
