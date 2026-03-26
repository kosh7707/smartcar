import React, { useState, useEffect, useRef } from "react";
import { healthCheck } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { POLL_HEALTH_MS } from "../constants/defaults";
import "./StatusBar.css";

type HealthStatus = "ok" | "degraded" | "unhealthy" | "disconnected" | "checking";

const STATUS_LABELS: Record<HealthStatus, string> = {
  ok: "정상",
  degraded: "제한적 동작",
  unhealthy: "비정상",
  disconnected: "연결 끊김",
  checking: "확인 중",
};

export const StatusBar: React.FC = () => {
  const toast = useToast();
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [detail, setDetail] = useState<string | null>(null);
  const prevStatus = useRef<HealthStatus>("checking");

  useEffect(() => {
    const check = async () => {
      try {
        const data = await healthCheck();
        const s = data?.status as string;

        if (s === "ok" || s === "degraded" || s === "unhealthy") {
          const newStatus = s as HealthStatus;
          setStatus(newStatus);

          // Build detail string for degraded/unhealthy
          if (s !== "ok") {
            const parts: string[] = [];
            for (const key of ["sastRunner", "analysisAgent", "llmGateway", "knowledgeBase", "buildAgent"] as const) {
              const svc = (data as Record<string, { status?: string }>)[key];
              if (svc?.status === "unreachable") {
                const labels: Record<string, string> = {
                  sastRunner: "SAST",
                  analysisAgent: "Agent",
                  llmGateway: "LLM",
                  knowledgeBase: "KB",
                  buildAgent: "Build",
                };
                parts.push(labels[key] ?? key);
              }
            }
            setDetail(parts.length > 0 ? `${parts.join(", ")} 미연결` : null);
          } else {
            setDetail(null);
          }

          // Toast on transition to degraded/unhealthy
          if (newStatus === "unhealthy" && prevStatus.current !== "unhealthy") {
            toast.error("핵심 서비스가 모두 미연결 상태입니다.");
          } else if (newStatus === "degraded" && prevStatus.current === "ok") {
            toast.warning("일부 서비스가 미연결 상태입니다.");
          }

          prevStatus.current = newStatus;
        } else {
          // Unexpected status value — treat as disconnected
          if (prevStatus.current !== "disconnected") {
            toast.error("백엔드 연결이 끊어졌습니다.");
          }
          setStatus("disconnected");
          setDetail(null);
          prevStatus.current = "disconnected";
        }
      } catch {
        if (prevStatus.current !== "disconnected") {
          toast.error("백엔드 연결이 끊어졌습니다.");
        }
        setStatus("disconnected");
        setDetail(null);
        prevStatus.current = "disconnected";
      }
    };

    check();
    const interval = setInterval(check, POLL_HEALTH_MS);
    return () => clearInterval(interval);
  }, [toast]);

  const dotClass = (() => {
    switch (status) {
      case "ok": return "ok";
      case "degraded": return "warning";
      case "unhealthy":
      case "disconnected": return "error";
      case "checking": return "checking";
    }
  })();

  return (
    <div className="statusbar">
      <div className="statusbar-item">
        <span>AEGIS v0.2.0</span>
      </div>
      <div className="statusbar-item" role="status" aria-live="polite" title={detail ?? STATUS_LABELS[status]}>
        <span className={`status-dot ${dotClass}`} aria-hidden="true" />
        <span>{STATUS_LABELS[status]}</span>
        {detail && <span className="statusbar-detail">{detail}</span>}
      </div>
    </div>
  );
};
