import { useCallback, useEffect, useMemo, useState } from "react";
import { getBackendUrl, healthFetch, setBackendUrl } from "../../../api/client";
import { getThemePreference, setThemePreference, type ThemePreference } from "../../../utils/theme";

export type TestStatus = "idle" | "testing" | "ok" | "error";

export function useSettingsPage() {
  const [url, setUrl] = useState(getBackendUrl);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testDetail, setTestDetail] = useState("");
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    document.title = "AEGIS — Settings";
  }, []);

  const handleThemeChange = useCallback((preference: ThemePreference) => {
    setTheme(preference);
    setThemePreference(preference);
  }, []);

  const handleUrlChange = useCallback((value: string) => {
    setUrl(value);
    setTestStatus("idle");
    setTestDetail("");
  }, []);

  const handleSave = useCallback(() => {
    setBackendUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [url]);

  const handleReset = useCallback(() => {
    setBackendUrl("");
    setUrl(getBackendUrl());
    setTestStatus("idle");
    setTestDetail("");
  }, []);

  const handleCancel = useCallback(() => {
    setUrl(getBackendUrl());
    setTestStatus("idle");
    setTestDetail("");
  }, []);

  const handleTest = useCallback(async () => {
    setTestStatus("testing");
    setTestDetail("");
    const { ok, data } = await healthFetch(url.trim());
    if (ok && data) {
      setTestStatus("ok");
      setTestDetail(`${data.service ?? "backend"} ${data.version ?? ""}`.trim());
      return;
    }

    setTestStatus("error");
    setTestDetail(ok ? "비정상 응답" : "연결 실패");
  }, [url]);

  const urlDirty = useMemo(() => url !== getBackendUrl(), [url]);

  return {
    url,
    saved,
    testStatus,
    testDetail,
    theme,
    urlDirty,
    handleUrlChange,
    handleThemeChange,
    handleSave,
    handleReset,
    handleCancel,
    handleTest,
  };
}
