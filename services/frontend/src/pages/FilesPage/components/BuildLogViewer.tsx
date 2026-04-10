import React, { useState, useEffect } from "react";
import { X, Copy, Check } from "lucide-react";
import { fetchBuildLog } from "../../../api/pipeline";
import { logError } from "../../../api/core";
import { Spinner } from "../../../shared/ui";
import "./BuildLogViewer.css";

interface Props {
  projectId: string;
  targetId: string;
  targetName: string;
  onClose: () => void;
}

export const BuildLogViewer: React.FC<Props> = ({ projectId, targetId, targetName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [buildLog, setBuildLog] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBuildLog(projectId, targetId)
      .then((res) => {
        if (cancelled) return;
        setBuildLog(res.buildLog);
        setStatus(res.status);
        setUpdatedAt(res.updatedAt);
      })
      .catch((e) => {
        logError("fetchBuildLog", e);
        if (!cancelled) setBuildLog(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId, targetId]);

  const handleCopy = async () => {
    if (!buildLog) return;
    try {
      await navigator.clipboard.writeText(buildLog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      logError("clipboard copy", e);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="build-log-overlay" onClick={handleOverlayClick}>
      <div className="build-log-modal">
        <div className="build-log-header">
          <div className="build-log-header__title">
            <span>{targetName} - 빌드 로그</span>
            {status && <span style={{ fontSize: "var(--cds-type-xs)", color: "var(--cds-text-placeholder)", fontWeight: "normal" }}>({status})</span>}
          </div>
          <div className="build-log-actions">
            {buildLog && (
              <button className="btn btn-secondary btn-sm" onClick={handleCopy} title="복사">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "복사됨" : "복사"}
              </button>
            )}
            <button className="btn-icon" onClick={onClose} title="닫기">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="build-log-body">
          {loading ? (
            <Spinner size={24} label="로그 불러오는 중..." />
          ) : buildLog ? (
            <pre className="build-log-pre">{buildLog}</pre>
          ) : (
            <div className="build-log-empty">빌드 로그가 없습니다</div>
          )}
        </div>
      </div>
    </div>
  );
};
