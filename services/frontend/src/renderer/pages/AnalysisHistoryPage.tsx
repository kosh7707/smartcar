import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Run } from "@aegis/shared";
import { Clock } from "lucide-react";
import { fetchProjectRuns, logError } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { PageHeader, EmptyState, ListItem, Spinner } from "../components/ui";
import { formatDateTime, formatUptime } from "../utils/format";
import { MODULE_META } from "../constants/modules";
import "./AnalysisHistoryPage.css";

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "static_analysis", label: "정적 분석" },
  { value: "deep_analysis", label: "심층 분석" },
];

const STATUS_LABELS: Record<string, string> = {
  completed: "완료",
  running: "실행 중",
  failed: "실패",
  queued: "대기",
};

export const AnalysisHistoryPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const toast = useToast();

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetchProjectRuns(projectId)
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setRuns(sorted);
      })
      .catch((e) => { logError("Fetch analysis history", e); toast.error("분석 이력을 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, [projectId, toast]);

  const filtered = filter === "all"
    ? runs
    : runs.filter((r) => r.module === filter);

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
          filtered.map((r) => {
            const meta = MODULE_META[r.module] ?? { label: r.module, icon: null };
            const durationSec = r.startedAt && r.endedAt
              ? (new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()) / 1000
              : 0;
            return (
              <ListItem
                key={r.id}
                onClick={() => navigate(`/projects/${projectId}/static-analysis`)}
                trailing={
                  <span className="history-item-time">{formatDateTime(r.createdAt)}</span>
                }
              >
                <div>
                  <div className="history-item-header">
                    <span className="history-item-icon">{meta.icon}</span>
                    <span className="history-item-label">{meta.label}</span>
                    <span className={`badge badge-sm badge-${r.status === "completed" ? "low" : r.status === "failed" ? "high" : "info"}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    {r.findingCount > 0 && (
                      <span className="history-item-findings">Finding {r.findingCount}건</span>
                    )}
                    {durationSec > 0 && (
                      <span className="history-item-duration">{formatUptime(durationSec)}</span>
                    )}
                  </div>
                  <div className="history-item-id">{r.id}</div>
                </div>
              </ListItem>
            );
          })
        )}
      </div>
    </div>
  );
};
