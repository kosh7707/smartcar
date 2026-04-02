import { useEffect, useCallback, useRef } from "react";

export interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * Keyboard shortcuts hook. Keys are event.key values (case-sensitive).
 * Shortcuts are disabled when the user is typing in an input, textarea, or select.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const fn = shortcutsRef.current[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    },
    [enabled],
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}
