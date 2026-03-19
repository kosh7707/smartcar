import { useState, useCallback, useRef, useEffect } from "react";
import type {
  DynamicTestConfig,
  DynamicTestResult,
  DynamicTestFinding,
  WsTestMessage,
} from "@aegis/shared";
import { runDynamicTest, getWsBaseUrl } from "../api/client";

export type TestView = "config" | "running" | "results";

export interface TestProgress {
  current: number;
  total: number;
  crashes: number;
  anomalies: number;
  message: string;
}

export function useDynamicTest(projectId?: string) {
  const [view, setView] = useState<TestView>("config");
  const [progress, setProgress] = useState<TestProgress>({ current: 0, total: 0, crashes: 0, anomalies: 0, message: "" });
  const [findings, setFindings] = useState<DynamicTestFinding[]>([]);
  const [result, setResult] = useState<DynamicTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startTest = useCallback(async (config: DynamicTestConfig, adapterId: string) => {
    if (!projectId) return;
    setView("running");
    setProgress({ current: 0, total: config.count, crashes: 0, anomalies: 0, message: "테스트 준비 중..." });
    setFindings([]);
    setResult(null);
    setError(null);

    const testId = `test-${crypto.randomUUID()}`;

    // 1. WS connect first (spec: must connect before POST)
    const wsUrl = `${getWsBaseUrl()}/ws/dynamic-test?testId=${testId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg: WsTestMessage = JSON.parse(evt.data);
        switch (msg.type) {
          case "test-progress":
            setProgress({
              current: msg.payload.current,
              total: msg.payload.total,
              crashes: msg.payload.crashes,
              anomalies: msg.payload.anomalies,
              message: msg.payload.message,
            });
            break;
          case "test-finding":
            setFindings((prev) => [...prev, msg.payload.finding]);
            break;
          case "test-complete":
            // Result will arrive from HTTP response
            break;
          case "test-error":
            setError(msg.payload.error);
            setView("config");
            cleanup();
            break;
        }
      } catch (e) { console.warn("[WS:dynamic-test] malformed message:", e); }
    };

    ws.onerror = () => {
      console.warn("[WS:dynamic-test] error (non-fatal, HTTP response still works)");
    };

    // 2. POST to start (wait briefly for WS to connect)
    await new Promise((r) => setTimeout(r, 100));

    try {
      const res = await runDynamicTest(projectId, config, adapterId, testId);
      setResult(res);
      setView("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "테스트 실행 실패");
      setView("config");
    } finally {
      cleanup();
    }
  }, [projectId, cleanup]);

  const reset = useCallback(() => {
    setView("config");
    setProgress({ current: 0, total: 0, crashes: 0, anomalies: 0, message: "" });
    setFindings([]);
    setResult(null);
    setError(null);
    cleanup();
  }, [cleanup]);

  const viewResult = useCallback((r: DynamicTestResult) => {
    setResult(r);
    setFindings(r.findings);
    setView("results");
  }, []);

  return {
    view,
    progress,
    findings,
    result,
    error,
    startTest,
    reset,
    viewResult,
  };
}
