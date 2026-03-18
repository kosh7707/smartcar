import React, { useEffect, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { healthCheck } from "../api/client";
import { useAdapters } from "../hooks/useAdapters";
import "./StatusBar.css";

export const StatusBar: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<"ok" | "error" | "checking">("checking");
  const [llmStatus, setLlmStatus] = useState<"ok" | "error" | "checking">("checking");
  const projectMatch = useMatch("/projects/:projectId/*");
  const projectId = projectMatch?.params.projectId;
  const { adapters, connected } = useAdapters(projectId);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const data = await healthCheck();
        if (cancelled) return;
        setBackendStatus(data?.status === "ok" ? "ok" : "error");
        // LLM status from backend's server-side health check (llmGateway field)
        const gw = data?.llmGateway;
        if (gw) {
          setLlmStatus(gw.status === "ok" ? "ok" : "error");
        } else if (projectId) {
          // Backend didn't include llmGateway — treat as unknown
          setLlmStatus("error");
        }
      } catch {
        if (cancelled) return;
        setBackendStatus("error");
        if (projectId) setLlmStatus("error");
      }
    };

    check();
    const interval = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [projectId]);

  const adapterClass = adapters.length === 0 ? "neutral" : connected.length === adapters.length ? "ok" : connected.length > 0 ? "warning" : "error";
  const adapterLabel = adapters.length === 0 ? "미등록" : `${connected.length}/${adapters.length} 연결됨`;

  const goToSettings = () => {
    if (projectId) navigate(`/projects/${projectId}/settings`);
  };

  return (
    <div className="statusbar">
      <div
        className={`statusbar-item${projectId ? " statusbar-item--clickable" : ""}`}
        onClick={projectId ? goToSettings : undefined}
      >
        <span className={`status-dot ${backendStatus}`} />
        <span>Backend: {backendStatus === "checking" ? "확인 중..." : backendStatus === "ok" ? "연결됨" : "연결 안됨"}</span>
      </div>
      {projectId && (
        <>
          <div className="statusbar-item statusbar-item--clickable" onClick={goToSettings}>
            <span className={`status-dot ${llmStatus}`} />
            <span>LLM: {llmStatus === "checking" ? "확인 중..." : llmStatus === "ok" ? "연결됨" : "연결 안됨"}</span>
          </div>
          <div className="statusbar-item statusbar-item--clickable" onClick={goToSettings}>
            <span className={`status-dot ${adapterClass}`} />
            <span>Adapter: {adapterLabel}</span>
          </div>
        </>
      )}
      <div className="statusbar-item">
        <span>v0.1.0</span>
      </div>
    </div>
  );
};
