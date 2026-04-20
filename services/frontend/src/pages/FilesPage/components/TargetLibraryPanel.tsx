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
      <div className="target-library-panel target-library-panel--loading">
        <Spinner size={16} />
      </div>
    );
  }

  if (libs.length === 0) return null;

  return (
    <div className="target-library-panel">
      <div className="target-library-panel__head">
        <Library size={14} />
        <span className="target-library-panel__title">서드파티 라이브러리</span>
        <span className="target-library-panel__count">{includedCount}/{libs.length}개 포함</span>
      </div>

      <div className="target-library-panel__list">
        {libs.map((lib) => (
          <label
            key={lib.id}
            className="target-library-panel__item"
          >
            <Checkbox
              checked={lib.included}
              onCheckedChange={() => handleToggle(lib.id)}
              className="target-library-panel__checkbox"
            />
            <div className="target-library-panel__item-copy">
              <div className="target-library-panel__item-head">
                <span className="target-library-panel__item-name">{lib.name}</span>
                {lib.version && (
                  <Badge variant="outline" className="target-library-panel__item-version">
                    {lib.version}
                  </Badge>
                )}
              </div>
              <span className="target-library-panel__item-path">{lib.path}</span>
              {lib.modifiedFiles.length > 0 && (
                <span className="target-library-panel__item-modified" title={lib.modifiedFiles.join(", ")}>
                  <FileWarning size={11} />
                  수정 {lib.modifiedFiles.length}개
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      {dirty && (
        <div className="target-library-panel__actions">
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
