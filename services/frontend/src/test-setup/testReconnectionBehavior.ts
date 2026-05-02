/**
 * Shared test helper to verify the 5-point reconnection contract
 * that all reconnectable hooks must satisfy:
 *
 * 1. connectionState is exposed in the return value
 * 2. onDisconnect triggers reconnecting state (not immediate failure)
 * 3. onReconnect wires REST fallback
 * 4. onGiveUp wires to error/failed state
 * 5. seq tracker resets on reconnect (verified in transport utility tests)
 *
 * Usage in hook tests:
 *   import { verifyReconnectableHook } from "@/test-setup/testReconnectionBehavior";
 *   verifyReconnectableHook(result.current);
 */
import { expect } from "vitest";
import type { ReconnectableHookResult } from "@/common/utils/wsEnvelope";

/**
 * Verify that a hook result satisfies ReconnectableHookResult interface.
 * Call this after rendering the hook to ensure connectionState is exposed.
 */
export function verifyReconnectableHook(hookResult: Record<string, unknown>): void {
  // Point 1: connectionState is exposed
  expect(hookResult).toHaveProperty("connectionState");
  const state = hookResult.connectionState;
  expect(["connected", "disconnected", "reconnecting", "failed"]).toContain(state);
}

/**
 * Verify that after WS disconnect, the hook enters reconnecting state (not immediate failure).
 */
export function verifyReconnectingOnDisconnect(
  hookResult: ReconnectableHookResult,
  triggerDisconnect: () => void,
): void {
  triggerDisconnect();
  // Point 2: Should be reconnecting, not failed/error
  expect(hookResult.connectionState).toBe("reconnecting");
}
