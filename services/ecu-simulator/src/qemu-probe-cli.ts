import fs from "fs";
import path from "path";
import {
  resolveManifestOrThrow,
  runHostProbe,
  renderCommand,
  createResolvedHostRunCommand,
  createHostCompileCommands,
} from "./qemu-runtime";

function main(): void {
  const [, , command, manifestPath] = process.argv;

  if (command !== "sample" || !manifestPath) {
    printUsageAndExit();
  }

  const resolved = resolveManifestOrThrow(manifestPath);

  const compileCommands = createHostCompileCommands(resolved);
  if (!compileCommands || compileCommands.length === 0) {
    console.error("No host compile path is available for this manifest.");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(resolved.firmwarePath), { recursive: true });

  console.log("# Host compile");
  compileCommands.forEach((commandSpec) => {
    console.log(renderCommand(commandSpec));
  });

  console.log("");
  console.log("# Host run");
  console.log(renderCommand(createResolvedHostRunCommand(resolved)));
  const stdout = runHostProbe(resolved);
  process.stdout.write(stdout);
}

function printUsageAndExit(): never {
  console.error(
    "Usage: tsx src/qemu-probe-cli.ts sample <manifest-path>"
  );
  process.exit(1);
}

main();
