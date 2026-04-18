import React, { useState, useEffect, useCallback, useRef } from "react";
import { Library, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { TargetLibrary } from "../../../api/pipeline";
import { fetchTargetLibraries, updateTargetLibraries } from "../../../api/pipeline";
import { logError } from "../../../api/core";
import { useToast } from "../../../contexts/ToastContext";
import { Spinner } from "../../../shared/ui";

interface Props {
  projectId: string;
  targetId: string;
  targetName: string;
}

export const TargetLibraryPanel: React.FC<Props> = ({ projectId, targetId, targetName: _targetName }) => {
  const toast = useToast();
  const [libs, setLibs] = useState<TargetLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTargetLibraries(projectId, targetId);
      if (!mountedRef.current) return;
      setLibs(data);
      setDirty(false);
    } catch (e) {
      logError("Load libraries", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [projectId, targetId]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = useCallback((libId: string) => {
    setLibs((prev) =>
      prev.map((lib) => lib.id === libId ? { ...lib, included: !lib.included } : lib),
    );
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateTargetLibraries(
        projectId,
        targetId,
        libs.map((lib) => ({ id: lib.id, included: lib.included })),
      );
      toast.success("라이브러리 설정 저장 완료");
      if (mountedRef.current) setDirty(false);
    } catch (e) {
      logError("Save libraries", e);
      toast.error("라이브러리 설정 저장에 실패했습니다.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [projectId, targetId, libs, toast]);

  const includedCount = libs.filter((l) => l.included).length;

  if (loading) {
    return (
      <div className="mt-3 flex justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5">
        <Spinner size={16} />
      </div>
    );
  }

  if (libs.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Library size={14} />
        <span className="font-medium text-foreground">서드파티 라이브러리</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{includedCount}/{libs.length}개 포함</span>
      </div>

      <div className="space-y-2">
        {libs.map((lib) => (
          <label
            key={lib.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent bg-background/80 px-3 py-2 transition hover:border-border hover:bg-background"
          >
            <Checkbox
              checked={lib.included}
              onCheckedChange={() => handleToggle(lib.id)}
              className="mt-0.5"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{lib.name}</span>
                {lib.version && (
                  <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
                    {lib.version}
                  </Badge>
                )}
              </div>
              <span className="break-all font-mono text-xs text-muted-foreground sm:text-sm">{lib.path}</span>
              {lib.modifiedFiles.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300" title={lib.modifiedFiles.join(", ")}>
                  <FileWarning size={11} />
                  수정 {lib.modifiedFiles.length}개
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      {dirty && (
        <div className="flex gap-3 border-t border-border/70 pt-3">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : "설정 저장"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={saving}>
            취소
          </Button>
        </div>
      )}
    </div>
  );
};
