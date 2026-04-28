// Display formatters scoped to the run-as-document approvals surface.
// All times are derived from the user's local clock at render time.

export function paragraphsFromReason(reason: string): string[] {
  return reason
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function formatLeftLong(deltaMs: number): string {
  if (deltaMs <= 0) return "만료됨";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (hours < 24) {
    return m > 0 ? `${hours}시간 ${String(m).padStart(2, "0")}분` : `${hours}시간`;
  }
  const days = Math.floor(hours / 24);
  return `${days}일`;
}

export function formatLeftShort(deltaMs: number): string {
  if (deltaMs <= 0) return "만료";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}분 남음`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 남음`;
  return `${Math.floor(hours / 24)}일 남음`;
}

export function formatSubmittedShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const M = d.getMonth() + 1;
  const D = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${M}/${D} ${h}:${m}`;
}

export function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const delta = Date.now() - d;
  if (delta < 60_000) return "방금 전";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function formatHoursPrecise(ms: number | null): string {
  if (ms === null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 0.1) return "<0.1h";
  return `${hours.toFixed(1)}h`;
}
