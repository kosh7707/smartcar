import React from "react";
import type { FindingSourceType, FindingStatus, Severity } from "@aegis/shared";
import { ArrowUpDown, Keyboard, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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

const selectClassName =
  "h-9 min-w-[9rem] rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const chipClassName =
  "vuln-filter-chip inline-flex h-auto items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium text-foreground";

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
      <Card className="py-0 shadow-none">
        <CardContent className="space-y-4 px-4 py-4">
          <Tabs
            value={activeSeverity}
            onValueChange={(value) => setFilter(value as Severity | "all")}
            className="gap-0"
          >
            <TabsList className="vuln-filter-bar h-auto w-full flex-wrap justify-start gap-2 rounded-xl bg-muted/60 p-1">
              <TabsTrigger
                value="all"
                className="vuln-filter-tab flex-none rounded-lg px-3 py-2 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {SEVERITY_KO_LABELS.all}
                <Badge variant="outline" className="vuln-filter-count ml-1 rounded-full px-1.5 text-[11px]">
                  {counts.total}
                </Badge>
              </TabsTrigger>
              {SEVERITY_ORDER.map((severity) => (
                <TabsTrigger
                  key={severity}
                  value={severity}
                  className={cn(
                    "vuln-filter-tab flex-none rounded-lg px-3 py-2 data-[state=active]:shadow-sm",
                    activeSeverity === severity
                      ? cn(
                          "border-transparent",
                          SEVERITY_SURFACE_CLASSES[severity],
                        )
                      : "data-[state=active]:border-border data-[state=active]:bg-background",
                  )}
                >
                  {SEVERITY_KO_LABELS[severity]}
                  <Badge variant="outline" className="vuln-filter-count ml-1 rounded-full px-1.5 text-[11px]">
                    {counts[severity as keyof typeof counts]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-center">
            <label className="vuln-search-bar flex items-center gap-2 rounded-lg border border-input bg-background px-3 shadow-xs">
              <Search size={14} className="text-muted-foreground" />
              <Input
                type="text"
                className="vuln-search-input h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                placeholder="제목/위치 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>

            <div className="vuln-sort-bar flex flex-wrap items-center gap-2 xl:justify-end">
              <div className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-xs">
                <ArrowUpDown size={14} />
                <select
                  className="vuln-sort-select bg-transparent text-foreground outline-none"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "severity" | "createdAt" | "location")}
                >
                  <option value="severity">심각도</option>
                  <option value="createdAt">날짜</option>
                  <option value="location">위치</option>
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="정렬 방향"
                aria-label="정렬 방향"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>

            <select
              className={cn(selectClassName, "vuln-extra-select")}
              value={sourceTypeFilter}
              onChange={(e) => setSourceTypeFilter(e.target.value as FindingSourceType | "all")}
            >
              <option value="all">출처: 전체</option>
              {Object.entries(SOURCE_TYPE_LABELS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <select
                className={cn(selectClassName, "vuln-extra-select")}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FindingStatus | "all")}
              >
                <option value="all">상태: 전체</option>
                {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                className={cn(selectClassName, "vuln-extra-select")}
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as "none" | "ruleId" | "location")}
              >
                <option value="none">그루핑: 없음</option>
                <option value="ruleId">CWE/규칙별</option>
                <option value="location">위치별</option>
              </select>

              <Button
                type="button"
                variant={showShortcutHelp ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowShortcutHelp((prev) => !prev)}
              >
                <Keyboard size={14} />
                단축키
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasActiveFilters && (
        <div className="vuln-active-filters flex flex-wrap items-center gap-2">
          <span className="vuln-active-filters__label mr-1 text-sm text-muted-foreground">
            {filteredCount}건 / {totalCount}건 표시
          </span>
          {activeSeverity !== "all" && (
            <Badge variant="outline" className={cn(chipClassName, SEVERITY_SURFACE_CLASSES[activeSeverity])}>
              심각도: {activeSeverity.charAt(0).toUpperCase() + activeSeverity.slice(1)}
              <button
                type="button"
                className="vuln-filter-chip__x inline-flex size-4 items-center justify-center rounded-full text-current/70 transition hover:bg-black/5 hover:text-current"
                onClick={() => setFilter("all")}
                aria-label="심각도 필터 해제"
              >
                <X size={10} />
              </button>
            </Badge>
          )}
          {sourceTypeFilter !== "all" && (
            <Badge variant="outline" className={chipClassName}>
              출처: {SOURCE_TYPE_LABELS[sourceTypeFilter]}
              <button
                type="button"
                className="vuln-filter-chip__x inline-flex size-4 items-center justify-center rounded-full text-current/70 transition hover:bg-black/5 hover:text-current"
                onClick={() => setSourceTypeFilter("all")}
                aria-label="출처 필터 해제"
              >
                <X size={10} />
              </button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="outline" className={chipClassName}>
              상태: {FINDING_STATUS_LABELS[statusFilter]}
              <button
                type="button"
                className="vuln-filter-chip__x inline-flex size-4 items-center justify-center rounded-full text-current/70 transition hover:bg-black/5 hover:text-current"
                onClick={() => setStatusFilter("all")}
                aria-label="상태 필터 해제"
              >
                <X size={10} />
              </button>
            </Badge>
          )}
          {searchQuery.trim() && (
            <Badge variant="outline" className={chipClassName}>
              검색: &quot;{searchQuery}&quot;
              <button
                type="button"
                className="vuln-filter-chip__x inline-flex size-4 items-center justify-center rounded-full text-current/70 transition hover:bg-black/5 hover:text-current"
                onClick={() => setSearchQuery("")}
                aria-label="검색 필터 해제"
              >
                <X size={10} />
              </button>
            </Badge>
          )}
        </div>
      )}

      {showShortcutHelp && (
        <Card className="vuln-shortcut-help py-0 shadow-none">
          <CardContent className="space-y-3 px-4 py-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Keyboard size={14} /> 키보드 단축키
            </CardTitle>
            <div className="vuln-shortcut-list flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">j</kbd>
                /
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">k</kbd>{" "}
                다음/이전
              </span>
              <span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">o</kbd>
                /
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">엔터</kbd>{" "}
                상세 열기
              </span>
              <span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">Esc</kbd> 선택 초기화
              </span>
              <span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">?</kbd> 도움말 토글
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCount > 0 && (
        <Card className="vuln-bulk-bar border-primary/20 bg-primary/[0.04] py-0 shadow-none">
          <CardContent className="flex flex-wrap items-center gap-3 px-4 py-4">
            <Badge variant="outline" className="vuln-bulk-bar__count rounded-full border-primary/20 bg-background px-3 py-1 text-sm font-semibold text-primary">
              {selectedCount}건 선택
            </Badge>
            <select
              className={selectClassName}
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as FindingStatus | "")}
            >
              <option value="">상태 선택</option>
              {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
            <Input
              type="text"
              className="vuln-bulk-bar__reason h-9 min-w-[14rem] flex-1 bg-background"
              placeholder="사유 입력"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
            />
            <Button
              size="sm"
              onClick={onBulkAction}
              disabled={!bulkStatus || !bulkReason.trim() || bulkProcessing}
            >
              {bulkProcessing ? "처리 중..." : "적용"}
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              해제
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
};
