import { useCallback, useEffect, useMemo, useState } from "react";
import type { BuildProfile } from "@aegis/shared";
import type { SourceFileEntry } from "../../../api/client";
import { logError } from "../../../api/client";
import { fetchProjectSdks } from "../../../api/sdk";
import type { RegisteredSdk } from "../../../api/sdk";
import { useToast } from "../../../contexts/ToastContext";
import { useBuildTargets } from "../../../hooks/useBuildTargets";
import { DEFAULT_PROFILE } from "./useBuildTargetSection";

export const INCLUDED_PATHS_EDIT_UNSUPPORTED_TEXT = "현재 백엔드 계약상 includedPaths는 수정 API에서 갱신되지 않습니다. 파일 구성 변경이 필요하면 서브 프로젝트를 새로 만들고 기존 항목을 삭제하세요.";

export function useSubprojectCreateDialog({
  open,
  projectId,
  sourceFiles,
  initialName = "",
  initialProfile = DEFAULT_PROFILE,
  initialIncludedPaths = [],
  onCreated,
  onSubmit,
}: {
  open: boolean;
  projectId: string;
  sourceFiles: SourceFileEntry[];
  initialName?: string;
  initialProfile?: BuildProfile;
  initialIncludedPaths?: string[];
  onCreated?: () => void;
  onSubmit?: (payload: { name: string; profile: BuildProfile; includedPaths: string[] }) => Promise<void>;
}) {
  const toast = useToast();
  const buildTargets = useBuildTargets(projectId);
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<BuildProfile>(DEFAULT_PROFILE);
  const [creating, setCreating] = useState(false);
  const [registeredSdks, setRegisteredSdks] = useState<RegisteredSdk[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setProfile(initialProfile);
    const selected = sourceFiles
      .filter((sourceFile) => initialIncludedPaths.some((path) => sourceFile.relativePath === path || sourceFile.relativePath.startsWith(path)))
      .map((sourceFile) => sourceFile.relativePath);
    setChecked(new Set(selected));
    fetchProjectSdks(projectId)
      .then((data) => setRegisteredSdks(data.registered))
      .catch(() => setRegisteredSdks([]));
  }, [initialIncludedPaths, initialName, initialProfile, open, projectId, sourceFiles]);

  const handleToggle = useCallback((paths: string[], add: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const path of paths) {
        if (add) next.add(path);
        else next.delete(path);
      }
      return next;
    });
  }, []);

  const selectedFiles = useMemo(
    () => sourceFiles.filter((sourceFile) => checked.has(sourceFile.relativePath)),
    [checked, sourceFiles],
  );
  const selectedCount = selectedFiles.length;
  const selectedSize = selectedFiles.reduce((sum, sourceFile) => sum + (sourceFile.size || 0), 0);
  const includedPaths = useMemo(() => [...checked], [checked]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { toast.error("서브 프로젝트 이름을 입력해주세요."); return; }
    if (selectedCount === 0) { toast.error("파일을 1개 이상 선택해주세요."); return; }
    setCreating(true);
    try {
      if (onSubmit) {
        await onSubmit({ name: name.trim(), profile, includedPaths });
      } else {
        await buildTargets.add(name.trim(), `${name.trim()}/`, profile, includedPaths);
        onCreated?.();
      }
      toast.success(`서브 프로젝트 "${name.trim()}" ${onSubmit ? "수정" : "생성"} 완료 (${selectedCount}개 파일)`);
    } catch (error) {
      logError(onSubmit ? "Update subproject" : "Create subproject", error);
      toast.error(`서브 프로젝트 ${onSubmit ? "수정" : "생성"}에 실패했습니다.`);
    } finally {
      setCreating(false);
    }
  }, [buildTargets, includedPaths, name, onCreated, onSubmit, profile, selectedCount, toast]);

  return {
    name,
    setName,
    checked,
    profile,
    setProfile,
    creating,
    registeredSdks,
    selectedCount,
    selectedSize,
    handleToggle,
    handleCreate,
  };
}
