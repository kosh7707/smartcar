import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings, Cpu } from "lucide-react";
import {
  fetchProjectSettings, updateProjectSettings,
  logError,
} from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { PageHeader, Spinner } from "../components/ui";
import { BuildTargetSection } from "../components/static/BuildTargetSection";
import { DEFAULT_LLM_URL } from "../constants/defaults";
import "./SettingsPage.css";

export const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  // LLM settings
  const [llmUrl, setLlmUrl] = useState("");
  const [llmSaved, setLlmSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!projectId) return;
    fetchProjectSettings(projectId)
      .then((s) => { setLlmUrl(s.llmUrl); })
      .catch((e) => { logError("Load project settings", e); toast.error("설정을 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, [projectId, toast]);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const handleSaveLlm = useCallback(async () => {
    if (!projectId) return;
    try {
      const updated = await updateProjectSettings(projectId, { llmUrl });
      setLlmUrl(updated.llmUrl);
      setLlmSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setLlmSaved(false), 2000);
    } catch (e) {
      logError("Save LLM URL", e);
      toast.error("설정 저장에 실패했습니다.");
    }
  }, [projectId, llmUrl, toast]);

  const handleResetLlm = useCallback(async () => {
    if (!projectId) return;
    try {
      const updated = await updateProjectSettings(projectId, { llmUrl: "" });
      setLlmUrl(updated.llmUrl);
    } catch (e) { logError("Reset LLM URL", e); }
  }, [projectId]);

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner label="설정 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader title="프로젝트 설정" icon={<Settings size={20} />} />

      {/* LLM Gateway */}
      <div className="card gs-card">
        <div className="gs-card__header">
          <div className="gs-card__icon"><Cpu size={18} /></div>
          <div>
            <div className="gs-card__title">LLM Gateway</div>
            <div className="gs-card__desc">이 프로젝트에서 사용할 LLM Gateway 주소를 설정합니다. 비워두면 서버 기본값을 사용합니다.</div>
          </div>
        </div>

        <div className="gs-url-row">
          <input
            type="text"
            className="form-input gs-url-input"
            value={llmUrl}
            onChange={(e) => setLlmUrl(e.target.value)}
            placeholder={DEFAULT_LLM_URL}
            spellCheck={false}
          />
          <button className="btn btn-sm" onClick={handleSaveLlm}>
            {llmSaved ? "저장됨" : "저장"}
          </button>
        </div>

        <button className="gs-reset-link" onClick={handleResetLlm}>
          서버 기본값으로 초기화
        </button>
      </div>

      {/* Build Targets */}
      {projectId && (
        <BuildTargetSection
          projectId={projectId}
          onStartDeepAnalysis={(targetIds) => {
            navigate(`/projects/${projectId}/static-analysis`);
          }}
        />
      )}
    </div>
  );
};
