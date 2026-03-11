import type { UploadedFile } from "@smartcar/shared";

/**
 * Match a filename from vulnerability location against uploaded project files.
 * Handles multiple formats: exact name, exact path, or basename fallback.
 *
 * e.g. location "src/network/socket.c:42" → filename "src/network/socket.c"
 *   - f.name = "socket.c", f.path = "src/network/socket.c" → matches via path
 *   - f.name = "socket.c", no path → matches via basename fallback
 */
export function findFileByLocation(
  files: UploadedFile[],
  filename: string,
): UploadedFile | undefined {
  const basename = filename.split("/").pop() ?? filename;

  return (
    files.find((f) => f.name === filename) ??
    files.find((f) => f.path === filename) ??
    files.find((f) => f.name === basename)
  );
}
