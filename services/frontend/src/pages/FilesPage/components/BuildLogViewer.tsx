import React, { useState, useEffect } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchBuildLog } from "../../../api/pipeline";
import { logError } from "../../../api/core";
import { Spinner } from "../../../shared/ui";

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
      .catch((error) => {
        logError("fetchBuildLog", error);
        if (!cancelled) setBuildLog(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, targetId]);

  const handleCopy = async () => {
    if (!buildLog) return;
    try {
      await navigator.clipboard.writeText(buildLog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logError("clipboard copy", error);
    }
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="build-log-viewer"
        overlayClassName="build-log-overlay"
        onOverlayClick={onClose}
        showCloseButton={false}
      >
        <DialogHeader className="build-log-viewer__header">
          <DialogTitle className="build-log-viewer__title">
            <span className="build-log-viewer__title-text">{targetName} - 빌드 로그</span>
            {status ? <span className="build-log-viewer__status">({status})</span> : null}
          </DialogTitle>
          <div className="build-log-viewer__actions">
            {buildLog ? (
              <Button variant="outline" size="sm" onClick={handleCopy} title="복사">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "복사됨" : "복사"}
              </Button>
            ) : null}
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="닫기" aria-label="닫기">
              <X size={16} />
            </Button>
          </div>
        </DialogHeader>
        <div className="build-log-viewer__body">
          {loading ? (
            <Spinner size={24} label="로그 불러오는 중..." />
          ) : buildLog ? (
            <pre className="build-log-viewer__pre">{buildLog}</pre>
          ) : (
            <div className="build-log-viewer__empty">빌드 로그가 없습니다</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
