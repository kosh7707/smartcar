import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { AnalysisResult, AnalysisModule } from "@smartcar/shared";
import { Clock, Trash2 } from "lucide-react";
import { fetchAnalysisResults, deleteAnalysisResult } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { PageHeader, EmptyState, ConfirmDialog, SeveritySummary, ListItem, Spinner } from "../components/ui";
import { extractFiles } from "../utils/analysis";
import { formatDateTime } from "../utils/format";
import { MODULE_META, getModuleRoute } from "../constants/modules";
import "./AnalysisHistoryPage.css";

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
  const [confirmTarget, setConfirmTarget] = useState<AnalysisResult | null>(null);
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
    navigate(getModuleRoute(a.module, projectId!, a.id));
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
          <EmptyState
            icon={<Clock size={28} />}
            title={filter === "all" ? "아직 분석 이력이 없습니다" : "해당 모듈의 분석 이력이 없습니다"}
          />
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
                      onClick={(e) => { e.stopPropagation(); setConfirmTarget(a); }}
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

      <ConfirmDialog
        open={confirmTarget !== null}
        title="분석 이력 삭제"
        message={confirmTarget ? `이 분석 이력을 삭제하시겠습니까? (취약점 ${confirmTarget.summary.total}건)` : ""}
        confirmLabel="삭제"
        danger
        onConfirm={() => { if (confirmTarget) handleDelete(confirmTarget); setConfirmTarget(null); }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};
