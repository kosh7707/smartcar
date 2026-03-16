export function parseLocation(location?: string | null): { fileName: string; line?: string } {
  if (!location) return { fileName: "기타" };
  const lastColon = location.lastIndexOf(":");
  if (lastColon <= 0) return { fileName: location };
  const maybeLine = location.substring(lastColon + 1);
  if (!/^\d+$/.test(maybeLine)) return { fileName: location };
  return { fileName: location.substring(0, lastColon), line: maybeLine };
}

export function getHighlightLine(location?: string): number {
  if (!location) return -1;
  const match = location.match(/:(\d+)/);
  return match ? parseInt(match[1]) : -1;
}

export function getFileNameFromLocation(location?: string | null): string {
  return parseLocation(location).fileName;
}
