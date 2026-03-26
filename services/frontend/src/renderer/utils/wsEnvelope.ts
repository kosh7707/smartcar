/**
 * WS Envelope meta handling — seq gap detection and server timestamp extraction.
 *
 * Every WS message from S2 now includes an optional `meta` field:
 *   { type, payload, meta?: { channel, projectId?, timestamp, seq? } }
 *
 * This utility tracks per-channel sequence numbers and warns on gaps.
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
 * Returns typed message with optional meta.
 */
export function parseWsMessage<T = unknown>(data: string): WsMessage<T> {
  return JSON.parse(data) as WsMessage<T>;
}
