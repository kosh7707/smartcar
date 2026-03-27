import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { Vulnerability, Severity, AnalysisResult } from "@aegis/shared";
import { Shield, AlertTriangle, AlertCircle, Info, Calendar, Search, ArrowUpDown } from "lucide-react";
import { fetchProjectOverview, logError } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { VulnerabilityDetailView } from "../components/static/VulnerabilityDetailView";
import { PageHeader, EmptyState, SeverityBadge, SeveritySummary, Spinner } from "../components/ui";
import { SEVERITY_ORDER } from "../utils/severity";
import { formatDateTime } from "../utils/format";
import { MODULE_META } from "../constants/modules";
import "./VulnerabilitiesPage.css";

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={14} />,
  high: <AlertTriangle size={14} />,
  medium: <AlertCircle size={14} />,
  low: <Info size={14} />,
  info: <Info size={14} />,
};

export const VulnerabilitiesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [counts, setCounts] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"severity" | "createdAt" | "location">("severity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const toast = useToast();
  const activeSeverity = (searchParams.get("severity") as Severity | "all") || "all";

  useEffect(() => {
    if (!projectId) return;
    fetchProjectOverview(projectId)
      .then((ov) => {
        const completed = ov.recentAnalyses
          .filter((a: AnalysisResult) => a.status === "completed" && a.vulnerabilities.length > 0)
          .sort((a: AnalysisResult, b: AnalysisResult) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAnalyses(completed);

        const allVulns = completed.flatMap((a: AnalysisResult) => a.vulnerabilities);
        const infoCount = allVulns.filter((v) => v.severity === "info").length;
        setCounts({
          total: allVulns.length - infoCount,
          critical: allVulns.filter((v) => v.severity === "critical").length,
          high: allVulns.filter((v) => v.severity === "high").length,
          medium: allVulns.filter((v) => v.severity === "medium").length,
          low: allVulns.filter((v) => v.severity === "low").length,
          info: infoCount,
        });
      })
      .catch((e) => { logError("Load vulnerabilities", e); toast.error("취약점 목록을 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, [projectId]);

  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return analyses;
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
    return analyses.filter((a) => {
      const t = new Date(a.createdAt).getTime();
      return t >= from && t <= to;
    });
  }, [analyses, dateFrom, dateTo]);

  // Text search filter
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return dateFiltered;
    const q = searchQuery.trim().toLowerCase();
    return dateFiltered.map((a) => ({
      ...a,
      vulnerabilities: a.vulnerabilities.filter(
        (v) => v.title.toLowerCase().includes(q) || (v.location ?? "").toLowerCase().includes(q),
      ),
    })).filter((a) => a.vulnerabilities.length > 0);
  }, [dateFiltered, searchQuery]);

  // Sort within groups
  const sortedFiltered = useMemo(() => {
    return searchFiltered.map((a) => ({
      ...a,
      vulnerabilities: [...a.vulnerabilities].sort((x, y) => {
        let cmp = 0;
        if (sortBy === "severity") {
          cmp = SEVERITY_ORDER.indexOf(x.severity) - SEVERITY_ORDER.indexOf(y.severity);
        } else if (sortBy === "createdAt") {
          cmp = 0; // vulnerabilities don't have createdAt; keep original order
        } else if (sortBy === "location") {
          cmp = (x.location ?? "").localeCompare(y.location ?? "");
        }
        return sortOrder === "asc" ? cmp : -cmp;
      }),
    }));
  }, [searchFiltered, sortBy, sortOrder]);

  if (selectedVuln) {
    return (
      <VulnerabilityDetailView
        vulnerability={selectedVuln}
        projectId={projectId ?? ""}
        onBack={() => setSelectedVuln(null)}
      />
    );
  }

  const setFilter = (sev: Severity | "all") => {
    setSearchParams(sev === "all" ? {} : { severity: sev });
  };

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="취약점 로딩 중..." />
      </div>
    );
  }

  const hasFiltered = sortedFiltered.some((a) => {
    const vs = activeSeverity === "all" ? a.vulnerabilities : a.vulnerabilities.filter((v) => v.severity === activeSeverity);
    return vs.length > 0;
  });

  return (
    <div className="page-enter">
      <PageHeader title="취약점 목록" icon={<Shield size={20} />} subtitle={`총 ${counts.total}건`} />

      {/* Filter bar: severity tabs + date filter */}
      <div className="vuln-filter-bar">
        <button
          className={`vuln-filter-tab${activeSeverity === "all" ? " vuln-filter-tab--active" : ""}`}
          onClick={() => setFilter("all")}
        >
          <Shield size={14} />
          전체 <span className="vuln-filter-count">{counts.total}</span>
        </button>
        {SEVERITY_ORDER.map((sev) => (
          <button
            key={sev}
            className={`vuln-filter-tab vuln-filter-tab--${sev}${activeSeverity === sev ? " vuln-filter-tab--active" : ""}`}
            onClick={() => setFilter(sev)}
          >
            {SEVERITY_ICONS[sev]}
            {sev.charAt(0).toUpperCase() + sev.slice(1)}
            <span className="vuln-filter-count">{counts[sev as keyof typeof counts]}</span>
          </button>
        ))}

        <div className="vuln-search-bar">
          <Search size={14} />
          <input
            type="text"
            className="form-input vuln-search-input"
            placeholder="제목 또는 위치 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="vuln-sort-bar">
          <ArrowUpDown size={14} />
          <select className="form-input vuln-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="severity">심각도</option>
            <option value="location">위치</option>
          </select>
          <button className="btn-icon" title="정렬 방향" onClick={() => setSortOrder((o) => o === "asc" ? "desc" : "asc")}>
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <div className="vuln-date-filter">
          <Calendar size={14} className="vuln-date-filter__icon" />
          <input
            type="date"
            className="form-input vuln-date-filter__input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="vuln-date-filter__sep">~</span>
          <input
            type="date"
            className="form-input vuln-date-filter__input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          {(dateFrom || dateTo) && (
            <button className="btn-secondary btn-sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Grouped vulnerability list */}
      {!hasFiltered ? (
        <EmptyState
          icon={<Shield size={28} />}
          title={activeSeverity === "all" ? "발견된 취약점이 없습니다" : `${activeSeverity.toUpperCase()} 수준의 취약점이 없습니다`}
        />
      ) : (
        sortedFiltered.map((a) => {
          const meta = MODULE_META[a.module] ?? { label: a.module, icon: null, badge: "" };
          const filtered = activeSeverity === "all"
            ? a.vulnerabilities
            : a.vulnerabilities.filter((v) => v.severity === activeSeverity);

          if (filtered.length === 0) return null;

          return (
            <div key={a.id} className={`vuln-group vuln-group--${meta.badge} card`}>
              <div className="vuln-group__header">
                <div className="vuln-group__header-top">
                  <span className={`analysis-item__badge analysis-item__badge--${meta.badge}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="vuln-group__sep">·</span>
                  <span className="vuln-group__time">{formatDateTime(a.createdAt)}</span>
                  <span className="vuln-group__sep">·</span>
                  <span className="vuln-group__vcount">{filtered.length}건</span>
                </div>
                <SeveritySummary summary={a.summary} />
              </div>
              <div className="vuln-group__body vuln-list--animated">
                {filtered.map((v) => (
                  <div
                    key={v.id}
                    className={`vuln-card vuln-card--${v.severity}`}
                    onClick={() => setSelectedVuln(v)}
                  >
                    <div className="vuln-card-header">
                      <SeverityBadge severity={v.severity} size="sm" />
                      <span className="vuln-title">{v.title}</span>
                    </div>
                    <div className="vuln-card-meta">
                      <span className="vuln-location-link">{v.location ?? "N/A"}</span>
                      <span className="vuln-source">
                        {v.source === "rule" ? `룰 (${v.ruleId})` : "LLM"}
                      </span>
                    </div>
                    <div className="vuln-card-desc">{v.description}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
