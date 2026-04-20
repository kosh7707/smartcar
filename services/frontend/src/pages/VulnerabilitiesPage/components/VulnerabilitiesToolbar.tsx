import React from "react";
import type { FindingSourceType, FindingStatus, Severity } from "@aegis/shared";
import { ArrowUpDown, Keyboard, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FINDING_STATUS_LABELS, SOURCE_TYPE_LABELS } from "../../../constants/finding";
import { SEVERITY_ORDER } from "../../../utils/severity";
import { SEVERITY_KO_LABELS, SEVERITY_SURFACE_CLASSES } from "../vulnerabilitiesPresentation";

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

const selectClassName = "vuln-extra-select";
const chipClassName = "vuln-filter-chip";

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
}) => {
  return (
    <>
      <Card className="vuln-toolbar-card">
        <CardContent>
          <Tabs value={activeSeverity} onValueChange={(value) => setFilter(value as Severity | "all")} className="vuln-toolbar-tabs-shell">
            <TabsList className="vuln-toolbar-tabs">
              <TabsTrigger value="all" className="vuln-toolbar-tab">
                {SEVERITY_KO_LABELS.all}
                <Badge variant="outline" className="vuln-filter-count">{counts.total}</Badge>
              </TabsTrigger>
              {SEVERITY_ORDER.map((severity) => (
                <TabsTrigger
                  key={severity}
                  value={severity}
                  className={`vuln-toolbar-tab ${activeSeverity === severity ? SEVERITY_SURFACE_CLASSES[severity] : ""}`}
                >
                  {SEVERITY_KO_LABELS[severity]}
                  <Badge variant="outline" className="vuln-filter-count">{counts[severity as keyof typeof counts]}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="vuln-toolbar-grid">
            <label className="vuln-search-bar">
              <Search size={14} />
              <Input
                type="text"
                className="vuln-search-input"
                placeholder="제목/위치 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>

            <div className="vuln-sort-bar">
              <div className="vuln-sort-box">
                <ArrowUpDown size={14} />
                <select className="vuln-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as "severity" | "createdAt" | "location") }>
                  <option value="severity">심각도</option>
                  <option value="createdAt">날짜</option>
                  <option value="location">위치</option>
                </select>
              </div>
              <Button type="button" variant="outline" size="icon-sm" title="정렬 방향" aria-label="정렬 방향" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc") }>
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>

            <select className={selectClassName} value={sourceTypeFilter} onChange={(e) => setSourceTypeFilter(e.target.value as FindingSourceType | "all") }>
              <option value="all">출처: 전체</option>
              {Object.entries(SOURCE_TYPE_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select>

            <div className="vuln-sort-bar">
              <select className={selectClassName} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FindingStatus | "all") }>
                <option value="all">상태: 전체</option>
                {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
              </select>
              <select className={selectClassName} value={groupBy} onChange={(e) => setGroupBy(e.target.value as "none" | "ruleId" | "location") }>
                <option value="none">그루핑: 없음</option>
                <option value="ruleId">CWE/규칙별</option>
                <option value="location">위치별</option>
              </select>
              <Button type="button" variant={showShortcutHelp ? "secondary" : "outline"} size="sm" onClick={() => setShowShortcutHelp((prev) => !prev)}>
                <Keyboard size={14} /> 단축키
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasActiveFilters ? (
        <div className="vuln-active-filters">
          <span className="vuln-active-filters__label">{filteredCount}건 / {totalCount}건 표시</span>
          {activeSeverity !== "all" ? (
            <Badge variant="outline" className={`${chipClassName} ${SEVERITY_SURFACE_CLASSES[activeSeverity]}`}>
              심각도: {activeSeverity.charAt(0).toUpperCase() + activeSeverity.slice(1)}
              <button type="button" className="vuln-filter-chip__x" onClick={() => setFilter("all")} aria-label="심각도 필터 해제"><X size={10} /></button>
            </Badge>
          ) : null}
          {sourceTypeFilter !== "all" ? (
            <Badge variant="outline" className={chipClassName}>
              출처: {SOURCE_TYPE_LABELS[sourceTypeFilter]}
              <button type="button" className="vuln-filter-chip__x" onClick={() => setSourceTypeFilter("all")} aria-label="출처 필터 해제"><X size={10} /></button>
            </Badge>
          ) : null}
          {statusFilter !== "all" ? (
            <Badge variant="outline" className={chipClassName}>
              상태: {FINDING_STATUS_LABELS[statusFilter]}
              <button type="button" className="vuln-filter-chip__x" onClick={() => setStatusFilter("all")} aria-label="상태 필터 해제"><X size={10} /></button>
            </Badge>
          ) : null}
          {searchQuery.trim() ? (
            <Badge variant="outline" className={chipClassName}>
              검색: &quot;{searchQuery}&quot;
              <button type="button" className="vuln-filter-chip__x" onClick={() => setSearchQuery("")} aria-label="검색 필터 해제"><X size={10} /></button>
            </Badge>
          ) : null}
        </div>
      ) : null}

      {showShortcutHelp ? (
        <Card className="vuln-shortcut-help">
          <CardContent>
            <CardTitle className="inline-stack"><Keyboard size={14} /> 키보드 단축키</CardTitle>
            <div className="vuln-shortcut-list">
              <span><kbd className="vuln-shortcut-key">j</kbd>/<kbd className="vuln-shortcut-key">k</kbd> 다음/이전</span>
              <span><kbd className="vuln-shortcut-key">o</kbd>/<kbd className="vuln-shortcut-key">엔터</kbd> 상세 열기</span>
              <span><kbd className="vuln-shortcut-key">Esc</kbd> 선택 초기화</span>
              <span><kbd className="vuln-shortcut-key">?</kbd> 도움말 토글</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {selectedCount > 0 ? (
        <Card className="vuln-bulk-bar">
          <CardContent>
            <Badge variant="outline" className="vuln-bulk-bar__count">{selectedCount}건 선택</Badge>
            <select className={selectClassName} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as FindingStatus | "") }>
              <option value="">상태 선택</option>
              {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select>
            <Input type="text" className="vuln-bulk-bar__reason" placeholder="사유 입력" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
            <Button size="sm" onClick={onBulkAction} disabled={!bulkStatus || !bulkReason.trim() || bulkProcessing}>{bulkProcessing ? "처리 중..." : "적용"}</Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>해제</Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
};
