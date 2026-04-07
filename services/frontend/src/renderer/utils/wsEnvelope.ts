/**
 * WS Envelope meta handling — seq gap detection and server timestamp extraction.
 *
 * S2 backend sends WS messages in **flattened** shape:
 *   { type, ...fields, meta?: { channel, projectId?, timestamp, seq? } }
 *
 * parseWsMessage normalizes flattened → internal nested shape:
 *   { type, payload: { ...fields }, meta? }
 *
 * This allows hook code to use the consistent msg.payload.X access pattern.
 */

export interface WsEnvelopeMeta {
  channel: string;
  projectId?: string;
  timestamp: number;
  seq?: number;
}

export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
  meta?: WsEnvelopeMeta;
}

/**
 * Creates a seq tracker for a single WS connection.
 * Call `check(meta)` on each message to detect gaps.
 */
export function createSeqTracker(channelLabel: string) {
  let lastSeq: number | null = null;

  return {
    /** Check for seq gap. Returns gap size (0 = ok, >0 = missed messages). */
    check(meta?: WsEnvelopeMeta): number {
      if (!meta?.seq) return 0;
      const gap = lastSeq !== null ? meta.seq - lastSeq - 1 : 0;
      if (gap > 0) {
        console.warn(
          `[WS:${channelLabel}] seq gap detected: expected ${lastSeq! + 1}, got ${meta.seq} (${gap} message(s) missed)`,
        );
      }
      lastSeq = meta.seq;
      return Math.max(0, gap);
    },

    /** Reset tracker (e.g., on reconnect). */
    reset() {
      lastSeq = null;
    },
  };
}

/**
 * Parse WS message data with envelope support.
 * Normalizes S2's flattened shape { type, ...fields, meta } into
 * internal nested shape { type, payload: { ...fields }, meta }.
 * Also handles legacy nested shape for backward compatibility.
 */
export function parseWsMessage<T = unknown>(data: string): WsMessage<T> {
  const raw = JSON.parse(data);
  // Already in nested shape (has payload field) — pass through
  if (raw.payload !== undefined) {
    return raw as WsMessage<T>;
  }
  // Flattened shape from S2: { type, ...fields, meta } → { type, payload, meta }
  const { type, meta, ...rest } = raw;
  return { type, payload: rest as T, meta };
}
