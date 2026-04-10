import { useState, useEffect, useRef } from "react";

/**
 * 경과 시간 타이머 훅.
 * @param active true면 1초 간격으로 카운트, false면 정지
 * @param resetKey 값이 변경되면 0으로 리셋 (analysisId 등)
 */
export function useElapsedTimer(active: boolean, resetKey?: unknown) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [resetKey]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = Math.floor((Date.now() - startRef.current) / 1000);
        return next !== prev ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;

  return { elapsed, timeStr };
}
