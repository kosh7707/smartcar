import { useState, useCallback, useRef, useEffect } from "react";
import type {
  DynamicTestConfig,
  DynamicTestResult,
  DynamicTestFinding,
  WsTestMessage,
} from "@aegis/shared";
import { runDynamicTest, getWsBaseUrl } from "@/common/api/client";
import { parseWsMessage, createReconnectingWs } from "@/common/utils/wsEnvelope";
import type { ConnectionState, ReconnectableHookResult } from "@/common/utils/wsEnvelope";

export type TestView = "config" | "running" | "results";

export interface TestProgress {
  current: number;
  total: number;
  crashes: number;
  anomalies: number;
  message: string;
}

export function useDynamicTest(projectId?: string): {
  view: TestView;
  progress: TestProgress;
  findings: DynamicTestFinding[];
  result: DynamicTestResult | null;
  error: string | null;
  startTest: (config: DynamicTestConfig, adapterId: string) => Promise<void>;
  reset: () => void;
  viewResult: (r: DynamicTestResult) => void;
} & ReconnectableHookResult {
  const [view, setView] = useState<TestView>("config");
  const [progress, setProgress] = useState<TestProgress>({ current: 0, total: 0, crashes: 0, anomalies: 0, message: "" });
  const [findings, setFindings] = useState<DynamicTestFinding[]>([]);
  const [result, setResult] = useState<DynamicTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const rwsRef = useRef<ReturnType<typeof createReconnectingWs> | null>(null);

  const cleanup = useCallback(() => {
    if (rwsRef.current) {
      rwsRef.current.close();
      rwsRef.current = null;
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
    const wsUrl = `${getWsBaseUrl()}/ws/dynamic-test?testId=${testId}`;

    // WS connect first (spec: must connect before POST)
    const rws = createReconnectingWs(() => wsUrl, {
      maxRetries: 5,
      onStateChange: setConnectionState,
      onReconnect() {
        // Re-wire message handlers on new WS
        wireHandlers(rws.getWs());
      },
    });
    rwsRef.current = rws;

    function wireHandlers(ws: WebSocket | null) {
      if (!ws) return;
      ws.onmessage = (evt) => {
        try {
          const msg = parseWsMessage(evt.data) as unknown as WsTestMessage;
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
              break;
            case "test-error":
              setError(msg.payload.error);
              setView("config");
              cleanup();
              break;
          }
        } catch (e) { console.warn("[WS:dynamic-test] malformed message:", e); }
      };
    }
    wireHandlers(rws.getWs());

    // POST to start (wait briefly for WS to connect)
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
    setConnectionState("disconnected");
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
    connectionState,
    startTest,
    reset,
    viewResult,
  };
}
