import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { afterEach, describe, expect, it } from "vitest";
import { ArchiveExtractor } from "../../services/archive-extractor";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe("archive extractor", () => {
  it("rejects zip entries that escape the workspace", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s8-archive-"));
    dirs.push(dir);
    const workspace = path.join(dir, "workspace");
    const archive = buildZip("../evil.txt", "owned");
    const extractor = new ArchiveExtractor();

    expect(() => extractor.extract(archive, workspace, "evil.zip")).toThrow("Unsafe archive entry path");
    expect(fs.existsSync(path.join(dir, "evil.txt"))).toBe(false);
  });

  it("rejects tar entries that escape the workspace", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s8-archive-"));
    dirs.push(dir);
    const workspace = path.join(dir, "workspace");
    const archive = buildTar("../evil.txt", "owned");
    const extractor = new ArchiveExtractor();

    expect(() => extractor.extract(archive, workspace, "evil.tar")).toThrow("Unsafe archive entry path");
    expect(fs.existsSync(path.join(dir, "evil.txt"))).toBe(false);
  });
});

function buildZip(entryPath: string, contents: string): Buffer {
  return execFileSync("python3", ["-c", `
import io, sys, zipfile
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    zf.writestr(${JSON.stringify(entryPath)}, ${JSON.stringify(contents)})
sys.stdout.buffer.write(buf.getvalue())
`]);
}

function buildTar(entryPath: string, contents: string): Buffer {
  return execFileSync("python3", ["-c", `
import io, sys, tarfile
payload = ${JSON.stringify(contents)}.encode()
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w") as tf:
    info = tarfile.TarInfo(${JSON.stringify(entryPath)})
    info.size = len(payload)
    tf.addfile(info, io.BytesIO(payload))
sys.stdout.buffer.write(buf.getvalue())
`]);
}
