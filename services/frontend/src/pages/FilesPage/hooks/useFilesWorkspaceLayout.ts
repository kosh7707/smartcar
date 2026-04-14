import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "aegis:filesTreePanelWidth";
const DEFAULT_TREE_PANEL_WIDTH = 360;
const MIN_TREE_PANEL_WIDTH = 280;
const MAX_TREE_PANEL_WIDTH = 720;
const MIN_PREVIEW_WIDTH = 360;
const KEYBOARD_STEP = 32;

function clampWidth(nextWidth: number, containerWidth: number) {
  const maxAllowedByContainer = Math.max(MIN_TREE_PANEL_WIDTH, containerWidth - MIN_PREVIEW_WIDTH);
  return Math.min(Math.max(nextWidth, MIN_TREE_PANEL_WIDTH), Math.min(MAX_TREE_PANEL_WIDTH, maxAllowedByContainer));
}

function readInitialWidth() {
  if (typeof window === "undefined") return DEFAULT_TREE_PANEL_WIDTH;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_TREE_PANEL_WIDTH;
}

export function useFilesWorkspaceLayout() {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [treePanelWidth, setTreePanelWidth] = useState(readInitialWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(treePanelWidth));
    }
  }, [treePanelWidth]);

  const updateWidth = useCallback((nextWidth: number) => {
    const containerWidth = layoutRef.current?.getBoundingClientRect().width ?? (MAX_TREE_PANEL_WIDTH + MIN_PREVIEW_WIDTH);
    setTreePanelWidth(clampWidth(nextWidth, containerWidth));
  }, []);

  const nudgeResize = useCallback((delta: number) => {
    updateWidth(treePanelWidth + delta);
  }, [treePanelWidth, updateWidth]);

  const startResizing = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (typeof window !== "undefined" && window.innerWidth <= 900) {
      return;
    }

    const layoutRect = layoutRef.current?.getBoundingClientRect();
    if (!layoutRect) return;

    event.preventDefault();
    setIsResizing(true);

    const handlePointerMove = (moveEvent: MouseEvent) => {
      updateWidth(moveEvent.clientX - layoutRect.left);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
  }, [updateWidth]);

  useEffect(() => () => setIsResizing(false), []);

  return {
    layoutRef,
    treePanelWidth,
    isResizing,
    startResizing,
    nudgeResize: (direction: "left" | "right") => nudgeResize(direction === "left" ? -KEYBOARD_STEP : KEYBOARD_STEP),
  };
}
