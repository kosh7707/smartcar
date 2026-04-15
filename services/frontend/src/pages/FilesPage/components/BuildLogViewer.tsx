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

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="flex flex-col max-h-[80vh] max-w-[800px] grid-rows-[auto_1fr] gap-0 overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-[800px]"
        overlayClassName="build-log-overlay"
        onOverlayClick={onClose}
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-5 py-4">
          <DialogTitle className="flex min-w-0 items-center gap-3 text-base font-semibold text-foreground">
            <span className="truncate">{targetName} - 빌드 로그</span>
            {status && (
              <span className="shrink-0 text-xs font-normal text-muted-foreground">({status})</span>
            )}
          </DialogTitle>
          <div className="flex shrink-0 items-center gap-2">
            {buildLog && (
              <Button variant="outline" size="sm" onClick={handleCopy} title="복사">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "복사됨" : "복사"}
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="닫기" aria-label="닫기">
              <X size={16} />
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-background/80 p-5">
          {loading ? (
            <Spinner size={24} label="로그 불러오는 중..." />
          ) : buildLog ? (
            <pre className="m-0 whitespace-pre-wrap break-all font-mono text-sm leading-6 text-foreground">{buildLog}</pre>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">빌드 로그가 없습니다</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
