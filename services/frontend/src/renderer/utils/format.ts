export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}

export function formatTime(ts: string): string {
  if (ts.includes("T")) {
    return ts.split("T")[1]?.replace("Z", "").slice(0, 12) ?? ts;
  }
  return ts;
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (seconds < 86400) return `${h}시간 ${m}분`;
  const d = Math.floor(seconds / 86400);
  const rh = Math.floor((seconds % 86400) / 3600);
  return `${d}일 ${rh}시간`;
}
