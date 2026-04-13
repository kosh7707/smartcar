import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { Finding, Severity, FindingStatus, FindingSourceType } from "@aegis/shared";
import { Keyboard, Shield } from "lucide-react";
import { fetchProjectFindings, bulkUpdateFindingStatus, fetchFindingGroups } from "../../api/analysis";
import type { FindingGroup } from "../../api/analysis";
import { logError } from "../../api/core";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useToast } from "../../contexts/ToastContext";
import { FindingDetailView } from "../../shared/findings/FindingDetailView";
import {
  EmptyState,
  FindingStatusBadge,
  SeverityBadge,
  Spinner,
} from "../../shared/ui";
import { SEVERITY_ORDER } from "../../utils/severity";
import { VulnerabilitiesHeader } from "./components/VulnerabilitiesHeader";
import { VulnerabilitiesToolbar } from "./components/VulnerabilitiesToolbar";
import { VulnerabilityFindingCard } from "./components/VulnerabilityFindingCard";
import "./VulnerabilitiesPage.css";

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
      <VulnerabilitiesHeader totalActiveFindings={counts.total} />

      <VulnerabilitiesToolbar
        counts={counts}
        activeSeverity={activeSeverity}
        sourceTypeFilter={sourceTypeFilter}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        sortBy={sortBy}
        sortOrder={sortOrder}
        groupBy={groupBy}
        hasActiveFilters={hasActiveFilters}
        filteredCount={filtered.length}
        totalCount={findings.length}
        showShortcutHelp={showShortcutHelp}
        selectedCount={selectedIds.size}
        bulkStatus={bulkStatus}
        bulkReason={bulkReason}
        bulkProcessing={bulkProcessing}
        setFilter={setFilter}
        setSourceTypeFilter={setSourceTypeFilter}
        setStatusFilter={setStatusFilter}
        setSearchQuery={setSearchQuery}
        setSortBy={setSortBy}
        setSortOrder={setSortOrder}
        setGroupBy={(value) => { setGroupBy(value); setExpandedGroups(new Set()); }}
        setShowShortcutHelp={setShowShortcutHelp}
        setBulkStatus={setBulkStatus}
        setBulkReason={setBulkReason}
        clearSelection={() => setSelectedIds(new Set())}
        onBulkAction={handleBulkAction}
      />

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
            <VulnerabilityFindingCard
              key={f.id}
              finding={f}
              selected={selectedIds.has(f.id)}
              highlighted={idx === highlightIndex}
              cweDescription={f.cweId ? CWE_DESCRIPTIONS[f.cweId] : undefined}
              onOpen={() => setSelectedFindingId(f.id)}
              onToggleSelect={() => toggleSelect(f.id)}
            />
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
