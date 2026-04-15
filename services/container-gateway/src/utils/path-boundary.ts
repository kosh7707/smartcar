import path from "path";

export function assertPathWithin(rootPath: string, candidatePath: string, errorMessage: string): void {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(errorMessage);
}

export function resolvePathWithin(rootPath: string, unsafeRelativePath: string, errorMessage: string): string {
  const resolved = path.resolve(rootPath, unsafeRelativePath);
  assertPathWithin(rootPath, resolved, errorMessage);
  return resolved;
}

export function assertPosixPathWithin(rootPath: string, candidatePath: string, errorMessage: string): void {
  const root = path.posix.normalize(rootPath);
  const candidate = path.posix.normalize(candidatePath);
  const relative = path.posix.relative(root, candidate);
  if (relative === "" || (!relative.startsWith("..") && !path.posix.isAbsolute(relative))) {
    return;
  }
  throw new Error(errorMessage);
}

export function resolvePosixPathWithin(rootPath: string, unsafeRelativePath: string, errorMessage: string): string {
  const resolved = path.posix.normalize(path.posix.join(rootPath, unsafeRelativePath));
  assertPosixPathWithin(rootPath, resolved, errorMessage);
  return resolved;
}

export function normalizeArchiveEntryPath(entryPath: string): string {
  const normalized = entryPath.replace(/\\/g, "/");
  if (!normalized || normalized.includes("\0")) {
    throw new Error(`Unsafe archive entry path: ${entryPath}`);
  }
  if (path.posix.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Unsafe archive entry path: ${entryPath}`);
  }
  const collapsed = path.posix.normalize(normalized);
  if (collapsed === ".." || collapsed.startsWith("../")) {
    throw new Error(`Unsafe archive entry path: ${entryPath}`);
  }
  return collapsed;
}
