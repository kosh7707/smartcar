import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { AnalysisResult, AnalysisModule } from "@smartcar/shared";
import {
  Clock,
  FileSearch,
  Activity,
  FlaskConical,
  Trash2,
} from "lucide-react";
import { fetchAnalysisResults, deleteAnalysisResult } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { PageHeader, SeveritySummary, ListItem, Spinner } from "../components/ui";
import { extractFiles } from "../utils/analysis";
import { formatDateTime } from "../utils/format";
import "./AnalysisHistoryPage.css";

const MODULE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  static_analysis: { label: "정적 분석", icon: <FileSearch size={14} /> },
  dynamic_analysis: { label: "동적 분석", icon: <Activity size={14} /> },
  dynamic_testing: { label: "동적 테스트", icon: <FlaskConical size={14} /> },
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "static_analysis", label: "정적 분석" },
  { value: "dynamic_analysis", label: "동적 분석" },
  { value: "dynamic_testing", label: "동적 테스트" },
];

export const AnalysisHistoryPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const toast = useToast();

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetchAnalysisResults(projectId)
      .then(setResults)
      .catch((e) => { console.error("Failed to fetch analysis history:", e); toast.error("분석 이력을 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDelete = async (a: AnalysisResult) => {
    if (!confirm(`이 분석 이력을 삭제하시겠습니까? (취약점 ${a.summary.total}건)`)) return;
    try {
      await deleteAnalysisResult(a.id);
      setResults((prev) => prev.filter((h) => h.id !== a.id));
    } catch (e) {
      console.error("Delete analysis failed:", e);
      toast.error("분석 이력 삭제에 실패했습니다.");
    }
  };

  const filtered = filter === "all"
    ? results
    : results.filter((a) => a.module === filter);

  const navigateToResult = (a: AnalysisResult) => {
    const route = a.module === "static_analysis"
      ? `/projects/${projectId}/static-analysis?analysisId=${a.id}`
      : a.module === "dynamic_analysis"
        ? `/projects/${projectId}/dynamic-analysis`
        : `/projects/${projectId}/dynamic-test`;
    navigate(route);
  };

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="분석 이력 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader title="분석 이력" icon={<Clock size={20} />} />

      <div className="history-filter">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.value}
            className={`history-filter__btn${filter === f.value ? " active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <p className="history-empty-text">
            {filter === "all" ? "아직 분석 이력이 없습니다." : "해당 모듈의 분석 이력이 없습니다."}
          </p>
        ) : (
          filtered.map((a) => {
            const meta = MODULE_META[a.module] ?? { label: a.module, icon: null };
            const files = extractFiles(a);
            return (
              <ListItem
                key={a.id}
                onClick={() => navigateToResult(a)}
                trailing={
                  <div className="history-item-trailing">
                    <span className="history-item-time">{formatDateTime(a.createdAt)}</span>
                    <button
                      className="btn-icon btn-danger history-item-delete"
                      title="삭제"
                      onClick={(e) => { e.stopPropagation(); handleDelete(a); }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                }
              >
                <div>
                  <div className="history-item-header">
                    <span className="history-item-icon">{meta.icon}</span>
                    <span className="history-item-label">{meta.label}</span>
                    <SeveritySummary summary={a.summary} />
                  </div>
                  {files.length > 0 && (
                    <div className="history-item-files">{files.join(", ")}</div>
                  )}
                </div>
              </ListItem>
            );
          })
        )}
      </div>
    </div>
  );
};
