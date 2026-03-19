import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Settings,
  Cpu,
  Check,
  X,
} from "lucide-react";
import {
  fetchProjectSettings, updateProjectSettings,
  logError, healthFetch,
} from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { PageHeader, Spinner } from "../components/ui";
import { DEFAULT_LLM_URL } from "../constants/defaults";
import "./SettingsPage.css";

export const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  // LLM settings
  const [llmUrl, setLlmUrl] = useState("");
  const [llmSaved, setLlmSaved] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    if (!projectId) return;
    fetchProjectSettings(projectId)
      .then((s) => { setLlmUrl(s.llmUrl); })
      .catch((e) => { logError("Load project settings", e); toast.error("설정을 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
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
          <div className="gs-url-input-wrap">
            <input
              type="text"
              className="form-input gs-url-input"
              value={llmUrl}
              onChange={(e) => { setLlmUrl(e.target.value); setLlmTestResult("idle"); }}
              placeholder={DEFAULT_LLM_URL}
              spellCheck={false}
            />
            {llmTestResult === "ok" && <span className="gs-url-badge gs-url-badge--ok"><Check size={12} /></span>}
            {llmTestResult === "error" && <span className="gs-url-badge gs-url-badge--error"><X size={12} /></span>}
            {llmTesting && <span className="gs-url-badge gs-url-badge--testing"><Spinner size={12} /></span>}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              setLlmTesting(true);
              setLlmTestResult("idle");
              const { ok } = await healthFetch(llmUrl.trim() || DEFAULT_LLM_URL);
              setLlmTestResult(ok ? "ok" : "error");
              setLlmTesting(false);
            }}
            disabled={llmTesting}
          >
            테스트
          </button>
          <button
            className="btn btn-sm"
            onClick={async () => {
              if (!projectId) return;
              try {
                const updated = await updateProjectSettings(projectId, { llmUrl });
                setLlmUrl(updated.llmUrl);
                setLlmSaved(true);
                setTimeout(() => setLlmSaved(false), 2000);
              } catch (e) { logError("Save LLM URL", e); }
            }}
          >
            {llmSaved ? "저장됨" : "저장"}
          </button>
        </div>

        {llmTestResult !== "idle" && !llmTesting && (
          <div className={`gs-test-msg gs-test-msg--${llmTestResult}`}>
            {llmTestResult === "ok" ? "LLM Gateway 연결 성공" : "LLM Gateway 연결 실패"}
          </div>
        )}

        <button
          className="gs-reset-link"
          onClick={async () => {
            if (!projectId) return;
            try {
              const updated = await updateProjectSettings(projectId, { llmUrl: "" });
              setLlmUrl(updated.llmUrl);
              setLlmTestResult("idle");
            } catch (e) { logError("Reset LLM URL", e); }
          }}
        >
          서버 기본값으로 초기화
        </button>
      </div>
    </div>
  );
};
