import React from "react";
import type { FindingSourceType, FindingStatus, Severity } from "@aegis/shared";
import { ArrowUpDown, Keyboard, Search, X } from "lucide-react";
import { FINDING_STATUS_LABELS, SOURCE_TYPE_LABELS } from "../../../constants/finding";
import { SEVERITY_ORDER } from "../../../utils/severity";

interface VulnerabilitiesToolbarProps {
  counts: { total: number; critical: number; high: number; medium: number; low: number; info: number };
  activeSeverity: Severity | "all";
  sourceTypeFilter: FindingSourceType | "all";
  statusFilter: FindingStatus | "all";
  searchQuery: string;
  sortBy: "severity" | "createdAt" | "location";
  sortOrder: "asc" | "desc";
  groupBy: "none" | "ruleId" | "location";
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
  showShortcutHelp: boolean;
  selectedCount: number;
  bulkStatus: FindingStatus | "";
  bulkReason: string;
  bulkProcessing: boolean;
  setFilter: (severity: Severity | "all") => void;
  setSourceTypeFilter: (value: FindingSourceType | "all") => void;
  setStatusFilter: (value: FindingStatus | "all") => void;
  setSearchQuery: (value: string) => void;
  setSortBy: (value: "severity" | "createdAt" | "location") => void;
  setSortOrder: (value: "asc" | "desc") => void;
  setGroupBy: (value: "none" | "ruleId" | "location") => void;
  setShowShortcutHelp: (value: boolean | ((prev: boolean) => boolean)) => void;
  setBulkStatus: (value: FindingStatus | "") => void;
  setBulkReason: (value: string) => void;
  clearSelection: () => void;
  onBulkAction: () => void;
}

export const VulnerabilitiesToolbar: React.FC<VulnerabilitiesToolbarProps> = ({
  counts,
  activeSeverity,
  sourceTypeFilter,
  statusFilter,
  searchQuery,
  sortBy,
  sortOrder,
  groupBy,
  hasActiveFilters,
  filteredCount,
  totalCount,
  showShortcutHelp,
  selectedCount,
  bulkStatus,
  bulkReason,
  bulkProcessing,
  setFilter,
  setSourceTypeFilter,
  setStatusFilter,
  setSearchQuery,
  setSortBy,
  setSortOrder,
  setGroupBy,
  setShowShortcutHelp,
  setBulkStatus,
  setBulkReason,
  clearSelection,
  onBulkAction,
}) => (
  <>
    <div className="vuln-filter-bar">
      <button
        className={`vuln-filter-tab${activeSeverity === "all" ? " vuln-filter-tab--active" : ""}`}
        onClick={() => setFilter("all")}
      >
        전체 <span className="vuln-filter-count">{counts.total}</span>
      </button>
      {SEVERITY_ORDER.map((severity) => (
        <button
          key={severity}
          className={`vuln-filter-tab vuln-filter-tab--${severity}${activeSeverity === severity ? " vuln-filter-tab--active" : ""}`}
          onClick={() => setFilter(severity)}
        >
          {severity === "critical" ? "치명" : severity === "high" ? "높음" : severity === "medium" ? "보통" : severity === "low" ? "낮음" : "정보"}
          <span className="vuln-filter-count">{counts[severity as keyof typeof counts]}</span>
        </button>
      ))}

      <select
        className="form-input vuln-extra-select"
        value={sourceTypeFilter}
        onChange={(e) => setSourceTypeFilter(e.target.value as FindingSourceType | "all")}
      >
        <option value="all">출처: 전체</option>
        {Object.entries(SOURCE_TYPE_LABELS).map(([key, value]) => (
          <option key={key} value={key}>{value}</option>
        ))}
      </select>

      <select
        className="form-input vuln-extra-select"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as FindingStatus | "all")}
      >
        <option value="all">상태: 전체</option>
        {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => (
          <option key={key} value={key}>{value}</option>
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
          onChange={(e) => setSortBy(e.target.value as "severity" | "createdAt" | "location")}
        >
          <option value="severity">심각도</option>
          <option value="createdAt">날짜</option>
          <option value="location">위치</option>
        </select>
        <button
          className="btn-icon"
          title="정렬 방향"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        >
          {sortOrder === "asc" ? "↑" : "↓"}
        </button>
      </div>

      <select
        className="form-input vuln-extra-select"
        value={groupBy}
        onChange={(e) => setGroupBy(e.target.value as "none" | "ruleId" | "location")}
      >
        <option value="none">그루핑: 없음</option>
        <option value="ruleId">CWE/규칙별</option>
        <option value="location">위치별</option>
      </select>
    </div>

    {hasActiveFilters && (
      <div className="vuln-active-filters">
        <span className="vuln-active-filters__label">{filteredCount}건 / {totalCount}건 표시</span>
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

    {showShortcutHelp && (
      <div className="vuln-shortcut-help card">
        <div className="card-title flex-center flex-gap-2">
          <Keyboard size={14} /> 키보드 단축키
        </div>
        <div className="vuln-shortcut-list">
          <span><kbd>j</kbd>/<kbd>k</kbd> 다음/이전</span>
          <span><kbd>o</kbd>/<kbd>엔터</kbd> 상세 열기</span>
          <span><kbd>Esc</kbd> 선택 초기화</span>
          <span><kbd>?</kbd> 도움말 토글</span>
        </div>
      </div>
    )}

    {selectedCount > 0 && (
      <div className="vuln-bulk-bar card">
        <span className="vuln-bulk-bar__count">{selectedCount}건 선택</span>
        <select
          className="form-input"
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value as FindingStatus | "")}
        >
          <option value="">상태 선택</option>
          {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => (
            <option key={key} value={key}>{value}</option>
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
          onClick={onBulkAction}
          disabled={!bulkStatus || !bulkReason.trim() || bulkProcessing}
        >
          {bulkProcessing ? "처리 중..." : "적용"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={clearSelection}>
          해제
        </button>
      </div>
    )}
  </>
);
