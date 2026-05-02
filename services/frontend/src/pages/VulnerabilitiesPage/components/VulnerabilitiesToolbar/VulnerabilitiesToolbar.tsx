import "./VulnerabilitiesToolbar.css";
import React from "react";
import type { FindingSourceType, FindingStatus, Severity } from "@aegis/shared";
import { Search, X } from "lucide-react";
import { FINDING_STATUS_LABELS, SOURCE_TYPE_LABELS } from "@/common/constants/finding";
import { cn } from "@/common/utils/cn";
import { SEVERITY_ORDER } from "@/common/utils/severity";
import { SEVERITY_KO_LABELS } from "../../vulnerabilitiesPresentation";

interface VulnerabilitiesToolbarProps {
  counts: { total: number; critical: number; high: number; medium: number; low: number; info: number };
  activeSeverities: ReadonlySet<Severity>;
  allSeveritiesSize: number;
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
  toggleSeverity: (severity: Severity) => void;
  resetSeverities: () => void;
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

const SORT_LABELS: Record<"severity" | "createdAt" | "location", string> = {
  severity: "심각도",
  createdAt: "날짜",
  location: "위치",
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const VulnerabilitiesToolbar: React.FC<VulnerabilitiesToolbarProps> = ({
  counts,
  activeSeverities,
  allSeveritiesSize,
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
  toggleSeverity,
  resetSeverities,
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
}) => {
  const allActive = activeSeverities.size === allSeveritiesSize;
  const selectedLabel = SEVERITY_ORDER
    .filter((s) => activeSeverities.has(s))
    .map(capitalize)
    .join("+");
  const singleSeverity = !allActive && activeSeverities.size === 1
    ? (SEVERITY_ORDER.find((s) => activeSeverities.has(s)) ?? null)
    : null;

  return (
    <>
      <div className="vuln-command" role="region" aria-label="분석 이력 필터와 요약">
        <div className="vuln-command__row">
          <span className="vuln-command__marker">§ SEVERITY</span>
          <div className="vuln-command__sev-group" role="group" aria-label="심각도 필터 (다중선택)">
            <button
              type="button"
              aria-pressed={allActive}
              onClick={resetSeverities}
              className={cn(
                "vuln-sev-pill",
                allActive && "vuln-sev-pill--active",
              )}
            >
              {SEVERITY_KO_LABELS.all}
              <span className="vuln-sev-pill__count">{counts.total}</span>
            </button>
            {SEVERITY_ORDER.map((severity) => {
              const selected = !allActive && activeSeverities.has(severity);
              return (
                <button
                  key={severity}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSeverity(severity)}
                  className={cn(
                    "vuln-sev-pill",
                    `vuln-sev-pill--${severity}`,
                    selected && "vuln-sev-pill--active",
                  )}
                >
                  {SEVERITY_KO_LABELS[severity]}
                  <span className="vuln-sev-pill__count">{counts[severity as keyof typeof counts]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="vuln-command__row">
          <span className="vuln-command__marker">§ FILTER</span>
          <label className="vuln-command__search">
            <Search size={14} />
            <input
              type="text"
              className="vuln-command__search-input"
              placeholder="제목/위치 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <div className="vuln-command__sort" aria-label="정렬">
            <span className="vuln-command__sort-label">SORT</span>
            <select
              className="vuln-command__sort-select"
              aria-label="정렬 기준"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "severity" | "createdAt" | "location")}
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <button
              type="button"
              className="vuln-command__sort-toggle"
              aria-label={sortOrder === "asc" ? "오름차순" : "내림차순"}
              title={sortOrder === "asc" ? "오름차순" : "내림차순"}
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </div>

          <select
            className="vuln-command__select"
            aria-label="출처 필터"
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value as FindingSourceType | "all")}
          >
            <option value="all">출처: 전체</option>
            {Object.entries(SOURCE_TYPE_LABELS).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>

          <select
            className="vuln-command__select"
            aria-label="상태 필터"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FindingStatus | "all")}
          >
            <option value="all">상태: 전체</option>
            {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>

          <select
            className="vuln-command__select"
            aria-label="그루핑"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "none" | "ruleId" | "location")}
          >
            <option value="none">그루핑: 없음</option>
            <option value="ruleId">CWE/규칙별</option>
            <option value="location">위치별</option>
          </select>

          <span className="vuln-command__spacer" />

          <button
            type="button"
            className="vuln-command__shortcut"
            onClick={() => setShowShortcutHelp((prev) => !prev)}
            aria-pressed={showShortcutHelp}
          >
            <span className="vuln-command__shortcut-key">?</span>
            단축키
          </button>
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="vuln-active" aria-live="polite">
          <span className="vuln-active__summary">{`${filteredCount}건 / ${totalCount}건 표시`}</span>
          {!allActive ? (
            <span
              className={cn(
                "vuln-active__chip",
                singleSeverity && `vuln-active__chip--${singleSeverity}`,
              )}
            >
              심각도: {selectedLabel}
              <button
                type="button"
                className="vuln-active__chip-x"
                onClick={resetSeverities}
                aria-label="심각도 필터 해제"
              >
                <X size={11} />
              </button>
            </span>
          ) : null}
          {sourceTypeFilter !== "all" ? (
            <span className="vuln-active__chip">
              출처: {SOURCE_TYPE_LABELS[sourceTypeFilter]}
              <button
                type="button"
                className="vuln-active__chip-x"
                onClick={() => setSourceTypeFilter("all")}
                aria-label="출처 필터 해제"
              >
                <X size={11} />
              </button>
            </span>
          ) : null}
          {statusFilter !== "all" ? (
            <span className="vuln-active__chip">
              상태: {FINDING_STATUS_LABELS[statusFilter]}
              <button
                type="button"
                className="vuln-active__chip-x"
                onClick={() => setStatusFilter("all")}
                aria-label="상태 필터 해제"
              >
                <X size={11} />
              </button>
            </span>
          ) : null}
          {searchQuery.trim() ? (
            <span className="vuln-active__chip">
              검색: &quot;{searchQuery}&quot;
              <button
                type="button"
                className="vuln-active__chip-x"
                onClick={() => setSearchQuery("")}
                aria-label="검색 필터 해제"
              >
                <X size={11} />
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {showShortcutHelp ? (
        <div className="vuln-shortcut-help">
          <h3 className="vuln-shortcut-help__title">§ 키보드 단축키</h3>
          <div className="vuln-shortcut-help__list">
            <span className="vuln-shortcut-help__item">
              <kbd className="vuln-shortcut-help__key">j</kbd>
              <kbd className="vuln-shortcut-help__key">k</kbd>
              다음/이전
            </span>
            <span className="vuln-shortcut-help__item">
              <kbd className="vuln-shortcut-help__key">o</kbd>
              <kbd className="vuln-shortcut-help__key">↵</kbd>
              상세 열기
            </span>
            <span className="vuln-shortcut-help__item">
              <kbd className="vuln-shortcut-help__key">Esc</kbd>
              선택 초기화
            </span>
            <span className="vuln-shortcut-help__item">
              <kbd className="vuln-shortcut-help__key">?</kbd>
              도움말 토글
            </span>
          </div>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="vuln-bulk-bar" role="toolbar" aria-label="선택 항목 일괄 처리">
          <span className="vuln-bulk-bar__marker">§ BULK</span>
          <span className="vuln-bulk-bar__count">{selectedCount}건 선택</span>
          <select
            className="vuln-bulk-bar__select"
            aria-label="상태 선택"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as FindingStatus | "")}
          >
            <option value="">상태 선택</option>
            {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
          <input
            className="vuln-bulk-bar__reason"
            type="text"
            placeholder="사유 입력"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
          />
          <span className="vuln-bulk-bar__spacer" />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onBulkAction}
            disabled={!bulkStatus || !bulkReason.trim() || bulkProcessing}
          >
            {bulkProcessing ? "처리 중..." : "적용"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearSelection}
          >
            해제
          </button>
        </div>
      ) : null}
    </>
  );
};
