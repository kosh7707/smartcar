import React, { useState, useEffect, useCallback, useRef } from "react";
import { Library, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TargetLibrary } from "../../../api/pipeline";
import { fetchTargetLibraries, updateTargetLibraries } from "../../../api/pipeline";
import { logError } from "../../../api/core";
import { useToast } from "../../../contexts/ToastContext";
import { Spinner } from "../../../shared/ui";
import "./TargetLibraryPanel.css";

interface Props {
  projectId: string;
  targetId: string;
  targetName: string;
}

export const TargetLibraryPanel: React.FC<Props> = ({ projectId, targetId, targetName }) => {
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
    return <div className="tlib-loading"><Spinner size={16} /></div>;
  }

  if (libs.length === 0) return null;

  return (
    <div className="tlib">
      <div className="tlib__header">
        <Library size={14} />
        <span className="tlib__title">서드파티 라이브러리</span>
        <span className="tlib__count">{includedCount}/{libs.length}개 포함</span>
      </div>

      <div className="tlib__list">
        {libs.map((lib) => (
          <label key={lib.id} className="tlib__item">
            <input
              type="checkbox"
              checked={lib.included}
              onChange={() => handleToggle(lib.id)}
              className="tlib__checkbox"
            />
            <div className="tlib__info">
              <div className="tlib__name-line">
                <span className="tlib__name">{lib.name}</span>
                {lib.version && <span className="tlib__version">{lib.version}</span>}
              </div>
              <span className="tlib__path">{lib.path}</span>
              {lib.modifiedFiles.length > 0 && (
                <span className="tlib__modified" title={lib.modifiedFiles.join(", ")}>
                  <FileWarning size={11} />
                  수정 {lib.modifiedFiles.length}개
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      {dirty && (
        <div className="tlib__actions">
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
