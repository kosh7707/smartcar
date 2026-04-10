import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { Finding, Severity, FindingStatus, FindingSourceType } from "@aegis/shared";
import { Shield, AlertTriangle, AlertCircle, Info, Search, ArrowUpDown, X, FlaskConical, ExternalLink, Keyboard } from "lucide-react";
import { fetchProjectFindings, bulkUpdateFindingStatus, fetchFindingGroups } from "../api/analysis";
import type { FindingGroup } from "../api/analysis";
import { logError } from "../api/core";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useToast } from "../contexts/ToastContext";
import { FindingDetailView } from "../components/static/FindingDetailView";
import {
  EmptyState,
  SeverityBadge,
  Spinner,
  FindingStatusBadge,
  SourceBadge,
  ConfidenceBadge,
} from "../components/ui";
import { SEVERITY_ORDER } from "../utils/severity";
import { FINDING_STATUS_LABELS, SOURCE_TYPE_LABELS } from "../constants/finding";
import { formatDateTime } from "../utils/format";
import "./VulnerabilitiesPage.css";

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={14} />,
  high: <AlertTriangle size={14} />,
  medium: <AlertCircle size={14} />,
  low: <Info size={14} />,
  info: <Info size={14} />,
};

const CWE_DESCRIPTIONS: Record<string, string> = {
  "CWE-120": "버퍼 오버플로우 (Buffer Copy without Checking Size)",
  "CWE-121": "스택 기반 버퍼 오버플로우",
  "CWE-122": "힙 기반 버퍼 오버플로우",
  "CWE-125": "범위 밖 읽기 (Out-of-bounds Read)",
  "CWE-190": "정수 오버플로우",
  "CWE-252": "반환값 미검사 (Unchecked Return Value)",
  "CWE-287": "부적절한 인증",
  "CWE-295": "부적절한 인증서 검증",
  "CWE-306": "중요 기능의 인증 누락",
  "CWE-416": "해제 후 사용 (Use After Free)",
  "CWE-476": "널 포인터 역참조",
  "CWE-561": "도달 불가 코드 (Dead Code)",
  "CWE-676": "위험 함수 사용",
  "CWE-787": "범위 밖 쓰기 (Out-of-bounds Write)",
  "CWE-798": "하드코딩된 자격증명",
  "CWE-119": "메모리 버퍼 경계 미검사",
  "CWE-200": "민감 정보 노출",
  "CWE-400": "자원 소모 (Resource Exhaustion)",
  "CWE-415": "이중 해제 (Double Free)",
  "CWE-469": "포인터 연산에서의 잘못된 크기값 사용",
};

export const VulnerabilitiesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  useEffect(() => {
    document.title = "AEGIS — Vulnerabilities";
  }, []);

  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Filters
  const activeSeverity = (searchParams.get("severity") as Severity | "all") || "all";
  const [sourceTypeFilter, setSourceTypeFilter] = useState<FindingSourceType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FindingStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"severity" | "createdAt" | "location">("severity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Bulk triage
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<FindingStatus | "">("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Keyboard navigation
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // Finding groups
  const [groupBy, setGroupBy] = useState<"none" | "ruleId" | "location">("none");
  const [groups, setGroups] = useState<FindingGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupsLoading, setGroupsLoading] = useState(false);

  const loadFindings = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchProjectFindings(projectId);
      setFindings(data);
    } catch (e) {
      logError("Load findings", e);
      toast.error("Finding 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  useEffect(() => {
    if (groupBy === "none" || !projectId) {
      setGroups([]);
      return;
    }
    setGroupsLoading(true);
    fetchFindingGroups(projectId, groupBy)
      .then((res) => setGroups(res.groups))
      .catch((e) => { logError("FindingGroups", e); setGroups([]); })
      .finally(() => setGroupsLoading(false));
  }, [groupBy, projectId]);

  const counts = useMemo(() => {
    const c = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      if (f.severity !== "info") c.total++;
      c[f.severity as keyof typeof c]++;
    }
    return c;
  }, [findings]);

  const filtered = useMemo(() => {
    let result = findings;
    if (activeSeverity !== "all") result = result.filter((f) => f.severity === activeSeverity);
    if (sourceTypeFilter !== "all") result = result.filter((f) => f.sourceType === sourceTypeFilter);
    if (statusFilter !== "all") result = result.filter((f) => f.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          (f.location ?? "").toLowerCase().includes(q) ||
          (f.ruleId ?? "").toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "severity") {
        cmp = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
      } else if (sortBy === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "location") {
        cmp = (a.location ?? "").localeCompare(b.location ?? "");
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [findings, activeSeverity, sourceTypeFilter, statusFilter, searchQuery, sortBy, sortOrder]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((f) => f.id)));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkStatus || selectedIds.size === 0 || !bulkReason.trim()) return;
    setBulkProcessing(true);
    try {
      const result = await bulkUpdateFindingStatus(
        Array.from(selectedIds),
        bulkStatus as FindingStatus,
        bulkReason.trim(),
      );
      toast.success(
        `${result.updated}건 상태 변경 완료${result.failed > 0 ? ` (${result.failed}건 실패)` : ""}`,
      );
      setSelectedIds(new Set());
      setBulkStatus("");
      setBulkReason("");
      loadFindings();
    } catch (e) {
      logError("Bulk status", e);
      toast.error("벌크 상태 변경에 실패했습니다.");
    } finally {
      setBulkProcessing(false);
    }
  };

  useKeyboardShortcuts({
    j: () => setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1)),
    k: () => setHighlightIndex((i) => Math.max(i - 1, 0)),
    o: () => { if (highlightIndex >= 0 && filtered[highlightIndex]) setSelectedFindingId(filtered[highlightIndex].id); },
    Enter: () => { if (highlightIndex >= 0 && filtered[highlightIndex]) setSelectedFindingId(filtered[highlightIndex].id); },
    Escape: () => { setHighlightIndex(-1); setSelectedIds(new Set()); setShowShortcutHelp(false); },
    "?": () => setShowShortcutHelp((v) => !v),
  }, !selectedFindingId);

  const hasActiveFilters = activeSeverity !== "all" || sourceTypeFilter !== "all" || statusFilter !== "all" || searchQuery.trim() !== "";

  if (selectedFindingId) {
    return (
      <FindingDetailView
        findingId={selectedFindingId}
        projectId={projectId ?? ""}
        onBack={() => {
          setSelectedFindingId(null);
          loadFindings();
        }}
      />
    );
  }

  const setFilter = (sev: Severity | "all") => {
    setSearchParams(sev === "all" ? {} : { severity: sev });
  };

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="Finding 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* v6 large title with left border stripe */}
      <div className="vuln-page-header">
        <h1 className="vuln-page-header__title">Vulnerabilities</h1>
        <div className="vuln-page-header__meta">
          <span className="vuln-page-header__count">
            Total active findings: <strong>{counts.total}</strong>
          </span>
        </div>
      </div>

      {/* Filter bar */}
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

        <select
          className="form-input vuln-extra-select"
          value={sourceTypeFilter}
          onChange={(e) => setSourceTypeFilter(e.target.value as FindingSourceType | "all")}
        >
          <option value="all">출처: 전체</option>
          {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          className="form-input vuln-extra-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FindingStatus | "all")}
        >
          <option value="all">상태: 전체</option>
          {Object.entries(FINDING_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="vuln-search-bar">
          <Search size={14} />
          <input
            type="text"
            className="form-input vuln-search-input"
            placeholder="제목/위치 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="vuln-sort-bar">
          <ArrowUpDown size={14} />
          <select
            className="form-input vuln-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="severity">심각도</option>
            <option value="createdAt">날짜</option>
            <option value="location">위치</option>
          </select>
          <button
            className="btn-icon"
            title="정렬 방향"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <select
          className="form-input vuln-extra-select"
          value={groupBy}
          onChange={(e) => { setGroupBy(e.target.value as typeof groupBy); setExpandedGroups(new Set()); }}
        >
          <option value="none">그루핑: 없음</option>
          <option value="ruleId">CWE/규칙별</option>
          <option value="location">위치별</option>
        </select>
      </div>

      {/* Active filter summary */}
      {hasActiveFilters && (
        <div className="vuln-active-filters">
          <span className="vuln-active-filters__label">{filtered.length}건 / {findings.length}건 표시</span>
          {activeSeverity !== "all" && (
            <span className="vuln-filter-chip">
              심각도: {activeSeverity.charAt(0).toUpperCase() + activeSeverity.slice(1)}
              <button className="vuln-filter-chip__x" onClick={() => setFilter("all")}><X size={10} /></button>
            </span>
          )}
          {sourceTypeFilter !== "all" && (
            <span className="vuln-filter-chip">
              출처: {SOURCE_TYPE_LABELS[sourceTypeFilter]}
              <button className="vuln-filter-chip__x" onClick={() => setSourceTypeFilter("all")}><X size={10} /></button>
            </span>
          )}
          {statusFilter !== "all" && (
            <span className="vuln-filter-chip">
              상태: {FINDING_STATUS_LABELS[statusFilter]}
              <button className="vuln-filter-chip__x" onClick={() => setStatusFilter("all")}><X size={10} /></button>
            </span>
          )}
          {searchQuery.trim() && (
            <span className="vuln-filter-chip">
              검색: &quot;{searchQuery}&quot;
              <button className="vuln-filter-chip__x" onClick={() => setSearchQuery("")}><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* Shortcut help overlay */}
      {showShortcutHelp && (
        <div className="vuln-shortcut-help card">
          <div className="card-title flex-center flex-gap-2">
            <Keyboard size={14} /> 키보드 단축키
          </div>
          <div className="vuln-shortcut-list">
            <span><kbd>j</kbd>/<kbd>k</kbd> 다음/이전</span>
            <span><kbd>o</kbd>/<kbd>Enter</kbd> 상세 열기</span>
            <span><kbd>Esc</kbd> 선택 해제</span>
            <span><kbd>?</kbd> 도움말 토글</span>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="vuln-bulk-bar card">
          <span className="vuln-bulk-bar__count">{selectedIds.size}건 선택</span>
          <select
            className="form-input"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as FindingStatus | "")}
          >
            <option value="">상태 선택</option>
            {Object.entries(FINDING_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="text"
            className="form-input vuln-bulk-bar__reason"
            placeholder="사유 입력"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
          />
          <button
            className="btn btn-sm"
            onClick={handleBulkAction}
            disabled={!bulkStatus || !bulkReason.trim() || bulkProcessing}
          >
            {bulkProcessing ? "처리 중..." : "적용"}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedIds(new Set())}
          >
            <X size={12} /> 해제
          </button>
        </div>
      )}

      {/* Grouped view */}
      {groupBy !== "none" && groups.length > 0 && (
        <div className="vuln-groups card">
          {groupsLoading ? (
            <div className="centered-loader--compact"><Spinner size={24} /></div>
          ) : (
            groups.map((g) => {
              const isOpen = expandedGroups.has(g.key);
              const groupFindings = findings.filter((f) => g.findingIds.includes(f.id));
              return (
                <div key={g.key} className="vuln-group">
                  <div
                    className="vuln-group__header"
                    onClick={() => setExpandedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(g.key)) next.delete(g.key); else next.add(g.key);
                      return next;
                    })}
                  >
                    <span className="vuln-group__arrow">{isOpen ? "▼" : "▶"}</span>
                    <SeverityBadge severity={g.topSeverity as import("@aegis/shared").Severity} size="sm" />
                    <span className="vuln-group__key">{g.key}</span>
                    <span className="vuln-group__count">{g.count}건</span>
                  </div>
                  {isOpen && (
                    <div className="vuln-group__body">
                      {groupFindings.map((f) => (
                        <div key={f.id} className="vuln-group__item" onClick={() => setSelectedFindingId(f.id)}>
                          <SeverityBadge severity={f.severity} size="sm" />
                          <FindingStatusBadge status={f.status} size="sm" />
                          <span className="vuln-finding-title">{f.title}</span>
                          {f.location && <span className="vuln-finding-location">{f.location}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Finding list — v6 horizontal card rows */}
      {groupBy !== "none" && groups.length > 0 ? null : filtered.length === 0 ? (
        <EmptyState
          icon={<Shield size={28} />}
          title={
            activeSeverity === "all"
              ? "조건에 맞는 Finding이 없습니다"
              : `${activeSeverity.toUpperCase()} 수준의 Finding이 없습니다`
          }
        />
      ) : (
        <div className="vuln-finding-list">
          {filtered.map((f, idx) => (
            <div
              key={f.id}
              className={[
                "vuln-finding-card",
                `vuln-finding-card--${f.severity}`,
                selectedIds.has(f.id) ? "vuln-finding-card--selected" : "",
                idx === highlightIndex ? "vuln-finding-card--highlight" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setSelectedFindingId(f.id)}
            >
              {/* Checkbox */}
              <div
                className="vuln-finding-card__check"
                onClick={(e) => { e.stopPropagation(); toggleSelect(f.id); }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(f.id)}
                  onChange={() => toggleSelect(f.id)}
                />
              </div>

              {/* CWE + severity label */}
              <div className="vuln-finding-card__cwe-col">
                {f.cweId ? (
                  <span
                    className={`vuln-finding-card__cwe-id vuln-finding-card__cwe-id--${f.severity}`}
                    title={CWE_DESCRIPTIONS[f.cweId] ?? f.cweId}
                    onClick={(e) => {
                      e.stopPropagation();
                      const num = f.cweId!.replace("CWE-", "");
                      window.open(`https://cwe.mitre.org/data/definitions/${num}.html`, "_blank");
                    }}
                  >
                    {f.cweId} <ExternalLink size={9} style={{ display: "inline" }} />
                  </span>
                ) : (
                  <span className={`vuln-finding-card__cwe-id vuln-finding-card__cwe-id--${f.severity}`}>—</span>
                )}
                <span className="vuln-finding-card__sev-label">
                  {f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}
                </span>
              </div>

              {/* Main body */}
              <div className="vuln-finding-card__body">
                <div className="vuln-finding-card__title">
                  {f.title}
                  {f.sourceType === "agent" && f.detail && (
                    <span className="vuln-poc-badge" title="PoC 생성 가능">
                      <FlaskConical size={12} /> PoC
                    </span>
                  )}
                </div>
                <div className="vuln-finding-card__location-row">
                  {f.location && (
                    <span className="vuln-finding-card__location">{f.location}</span>
                  )}
                  <span className="vuln-finding-card__module">{formatDateTime(f.createdAt)}</span>
                </div>
              </div>

              {/* Right: status + source badges */}
              <div className="vuln-finding-card__actions">
                <FindingStatusBadge status={f.status} size="sm" />
                <SourceBadge sourceType={f.sourceType} ruleId={f.ruleId} />
                <ConfidenceBadge confidence={f.confidence} sourceType={f.sourceType} confidenceScore={f.confidenceScore} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Keyboard shortcut hint */}
      <div className="vuln-keyboard-hint">
        <Keyboard size={12} />
        <span><kbd>?</kbd> 키보드 단축키</span>
      </div>
    </div>
  );
};
