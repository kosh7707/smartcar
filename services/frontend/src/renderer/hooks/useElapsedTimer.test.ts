import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useElapsedTimer } from "./useElapsedTimer";

describe("useElapsedTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at 0 seconds", () => {
    const { result } = renderHook(() => useElapsedTimer(true));
    expect(result.current.elapsed).toBe(0);
    expect(result.current.timeStr).toBe("0초");
  });

  it("increments elapsed time when active", () => {
    const { result } = renderHook(() => useElapsedTimer(true));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.elapsed).toBe(3);
    expect(result.current.timeStr).toBe("3초");
  });

  it("formats minutes and seconds", () => {
    const { result } = renderHook(() => useElapsedTimer(true));

    act(() => {
      vi.advanceTimersByTime(75000); // 1분 15초
    });

    expect(result.current.elapsed).toBe(75);
    expect(result.current.timeStr).toBe("1분 15초");
  });

  it("does not increment when inactive", () => {
    const { result } = renderHook(() => useElapsedTimer(false));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.elapsed).toBe(0);
  });

  it("stops when active changes to false", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useElapsedTimer(active),
      { initialProps: { active: true } },
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.elapsed).toBe(3);

    rerender({ active: false });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Should stay at 3 (timer stopped)
    expect(result.current.elapsed).toBe(3);
  });

  it("resets when resetKey changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useElapsedTimer(true, resetKey),
      { initialProps: { resetKey: "a" } },
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.elapsed).toBe(5);

    rerender({ resetKey: "b" });
    expect(result.current.elapsed).toBe(0);
  });

  it("cleans up interval on unmount", () => {
    const { unmount } = renderHook(() => useElapsedTimer(true));

    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
