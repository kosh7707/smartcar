import React, { useMemo, useState, useCallback } from "react";
import type {
  Run,
  Finding,
  FindingStatus,
  FindingSourceType,
  EvidenceRef,
  GateResult,
  Severity,
} from "@aegis/shared";
import {
  FileCode,
  Plus,
  Layers,
  CheckSquare,
  History,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  StatCard,
  EmptyState,
  Spinner,
  GateResultCard,
  SeverityBadge,
  FindingStatusBadge,
  SourceBadge,
} from "../../../shared/ui";
import { bulkUpdateFindingStatus } from "../../../api/analysis";
import { OverviewSectionHeader } from "../../OverviewPage/components/OverviewSectionHeader";
import { TopFilesCard } from "./TopFilesCard";
import { parseLocation } from "../../../utils/location";
import {
  FINDING_STATUS_LABELS,
  FINDING_STATUS_ORDER,
  SOURCE_TYPE_LABELS,
} from "../../../constants/finding";

interface FindingWithEvidence {
  finding: Finding;
  evidenceRefs: EvidenceRef[];
}

interface Props {
  runDetail: {
    run: Run;
    gate?: GateResult;
    findings: FindingWithEvidence[];
  } | null;
  loading: boolean;
  onSelectFinding: (findingId: string) => void;
  onFileClick?: (filePath: string) => void;
  onNewAnalysis: () => void;
  onBulkStatusDone?: () => void;
}

interface FindingGroup {
  key: string;
  label: string;
  items: FindingWithEvidence[];
}

type GroupBy = "severity" | "file" | "status";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

function groupByFile(findings: FindingWithEvidence[]): FindingGroup[] {
  const map = new Map<string, FindingWithEvidence[]>();
  for (const f of findings) {
    const fileName = parseLocation(f.finding.location).fileName;
    if (!map.has(fileName)) map.set(fileName, []);
    map.get(fileName)!.push(f);
  }
  return Array.from(map.entries())
    .sort((a, b) => {
      if (a[0] === "기타") return 1;
      if (b[0] === "기타") return -1;
      return b[1].length - a[1].length;
    })
    .map(([key, items]) => ({ key, label: key, items }));
}

function groupBySeverity(findings: FindingWithEvidence[]): FindingGroup[] {
  const map = new Map<string, FindingWithEvidence[]>();
  for (const f of findings) {
    const sev = f.finding.severity;
    if (!map.has(sev)) map.set(sev, []);
    map.get(sev)!.push(f);
  }
  return SEVERITY_ORDER.filter((s) => map.has(s)).map((s) => ({
    key: s,
    label: SEVERITY_LABELS[s],
    items: map.get(s)!,
  }));
}

function groupByStatus(findings: FindingWithEvidence[]): FindingGroup[] {
  const map = new Map<string, FindingWithEvidence[]>();
  for (const f of findings) {
    const st = f.finding.status;
    if (!map.has(st)) map.set(st, []);
    map.get(st)!.push(f);
  }
  return FINDING_STATUS_ORDER.filter((s) => map.has(s)).map((s) => ({
    key: s,
    label: FINDING_STATUS_LABELS[s],
    items: map.get(s)!,
  }));
}

const GROUP_FNS: Record<GroupBy, (f: FindingWithEvidence[]) => FindingGroup[]> = {
  file: groupByFile,
  severity: groupBySeverity,
  status: groupByStatus,
};

function getSourceBarClass(sourceType: string): string {
  if (sourceType === "rule-engine") return "latest-analysis-distribution-fill latest-analysis-distribution-fill--rule";
  if (sourceType === "llm-assist") return "latest-analysis-distribution-fill latest-analysis-distribution-fill--ai";
  return "latest-analysis-distribution-fill latest-analysis-distribution-fill--hybrid";
}

export const LatestAnalysisTab: React.FC<Props> = ({
  runDetail,
  loading,
  onSelectFinding,
  onFileClick,
  onNewAnalysis,
  onBulkStatusDone,
}) => {
  if (loading) {
    return (
      <div className="latest-analysis-loading">
        <Spinner label="최신 분석 로딩 중..." />
      </div>
    );
  }

  if (!runDetail) {
    return (
      <EmptyState
        title="아직 완료된 분석이 없습니다"
        description="새 분석을 실행하여 코드 보안 상태를 확인하세요."
        action={
          <Button onClick={onNewAnalysis}>
            <Plus size={16} />새 분석
          </Button>
        }
      />
    );
  }

  return (
    <LatestAnalysisContent
      runDetail={runDetail}
      onSelectFinding={onSelectFinding}
      onFileClick={onFileClick}
      onBulkStatusDone={onBulkStatusDone}
    />
  );
};

const LatestAnalysisContent: React.FC<{
  runDetail: { run: Run; gate?: GateResult; findings: FindingWithEvidence[] };
  onSelectFinding: (findingId: string) => void;
  onFileClick?: (filePath: string) => void;
  onBulkStatusDone?: () => void;
}> = ({ runDetail, onSelectFinding, onFileClick, onBulkStatusDone }) => {
  const { gate, findings } = runDetail;

  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("severity");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<FindingSourceType | "all">("all");
  const [sortKey, setSortKey] = useState<"severity" | "createdAt" | "location">("severity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === findings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(findings.map((f) => f.finding.id)));
    }
  }, [selectedIds.size, findings]);

  const handleBulkStatus = useCallback(
    async (status: FindingStatus) => {
      if (selectedIds.size === 0) return;
      setBulkProcessing(true);
      try {
        await bulkUpdateFindingStatus([...selectedIds], status, "벌크 상태 변경");
        setSelectedIds(new Set());
        onBulkStatusDone?.();
      } catch {
        // error handled by apiFetch
      } finally {
        setBulkProcessing(false);
      }
    },
    [selectedIds, onBulkStatusDone],
  );

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      const s = f.finding.severity as keyof typeof counts;
      if (s in counts) counts[s]++;
    }
    return counts;
  }, [findings]);

  const critHighCount = severityCounts.critical + severityCounts.high;

  const unresolvedCount = useMemo(() => {
    const statuses: FindingStatus[] = ["open", "needs_review", "needs_revalidation", "sandbox"];
    return findings.filter((f) => statuses.includes(f.finding.status)).length;
  }, [findings]);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of findings) {
      const src = f.finding.sourceType;
      counts[src] = (counts[src] || 0) + 1;
    }
    return counts;
  }, [findings]);
  const sourceTotal = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

  const topFiles = useMemo(() => {
    const fileMap = new Map<string, { count: number; topSeverity: Severity }>();
    for (const f of findings) {
      const fileName = parseLocation(f.finding.location).fileName;
      const existing = fileMap.get(fileName);
      const sev = f.finding.severity as Severity;
      if (!existing) {
        fileMap.set(fileName, { count: 1, topSeverity: sev });
      } else {
        existing.count++;
        if (SEVERITY_ORDER.indexOf(sev) < SEVERITY_ORDER.indexOf(existing.topSeverity)) {
          existing.topSeverity = sev;
        }
      }
    }
    return Array.from(fileMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([filePath, { count, topSeverity }]) => ({
        filePath,
        findingCount: count,
        topSeverity,
      }));
  }, [findings]);

  const filteredFindings = useMemo(() => {
    let result = findings;
    if (severityFilter !== "all") {
      result = result.filter((f) => f.finding.severity === severityFilter);
    }
    if (sourceTypeFilter !== "all") {
      result = result.filter((f) => f.finding.sourceType === sourceTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (f) =>
          f.finding.title.toLowerCase().includes(q) ||
          (f.finding.location?.toLowerCase().includes(q) ?? false),
      );
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "severity") {
        cmp = SEVERITY_ORDER.indexOf(a.finding.severity) - SEVERITY_ORDER.indexOf(b.finding.severity);
      } else if (sortKey === "createdAt") {
        cmp = new Date(a.finding.createdAt).getTime() - new Date(b.finding.createdAt).getTime();
      } else {
        cmp = (a.finding.location ?? "").localeCompare(b.finding.location ?? "");
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return result;
  }, [findings, severityFilter, sourceTypeFilter, searchQuery, sortKey, sortOrder]);

  const groups = useMemo(() => GROUP_FNS[groupBy](filteredFindings), [filteredFindings, groupBy]);

  return (
    <div className="latest-analysis-stack">
      <section className="latest-analysis-section">
        <OverviewSectionHeader title="품질 게이트" />
        {gate ? (
          <GateResultCard gate={gate} />
        ) : (
          <p className="latest-analysis-note">
            <span className="latest-analysis-note-prefix" aria-hidden="true" />
            Quality Gate가 설정되지 않았습니다
          </p>
        )}
      </section>

      <section className="latest-analysis-section">
        <OverviewSectionHeader title="보안 현황" />
        <div className="overview-security-posture__grid latest-analysis-severity-grid">
          <Card
            className={cn(
              "overview-security-posture__card overview-security-posture__card--total",
              severityFilter === "all" && "is-active",
            )}
            onClick={() => setSeverityFilter("all")}
          >
            <span className="overview-security-posture__eyebrow">총 Finding</span>
            <span className="overview-security-posture__value">{findings.length}</span>
            <span className="overview-security-posture__copy">
              {severityFilter === "all" ? "전체 표시 중" : "전체 보기"}
            </span>
          </Card>
          {(SEVERITY_ORDER.filter((s) => s !== "info") as Severity[]).map((sev) => (
            <Card
              key={sev}
              className={cn(
                "overview-security-posture__card overview-security-posture__card--severity",
                `overview-security-posture__card--${sev}`,
                severityFilter === sev && "is-active",
              )}
              onClick={() => setSeverityFilter(severityFilter === sev ? "all" : sev)}
            >
              <span
                className={cn(
                  "overview-security-posture__eyebrow",
                  `overview-security-posture__eyebrow--${sev}`,
                )}
              >
                {SEVERITY_LABELS[sev]}
              </span>
              <span className="overview-security-posture__value">{severityCounts[sev] ?? 0}</span>
              <span className="overview-security-posture__copy">
                {severityFilter === sev ? "필터 해제" : "해당 심각도만"}
              </span>
            </Card>
          ))}
        </div>

        <div className="latest-analysis-stats latest-analysis-substats">
          <StatCard
            label="치명 + 높음"
            value={critHighCount}
            color={critHighCount > 0 ? "var(--aegis-severity-high)" : undefined}
          />
          <StatCard
            label="미해결"
            value={unresolvedCount}
            color={unresolvedCount > 0 ? "var(--aegis-severity-high)" : undefined}
          />
        </div>
      </section>

      {findings.length > 0 && (
        <section className="latest-analysis-section">
          <OverviewSectionHeader title="분포" />
          <div className="latest-analysis-summary-grid">
            <Card className="latest-analysis-card">
              <CardContent className="latest-analysis-card-body">
                <CardTitle>출처별 분포</CardTitle>
              {sourceTotal === 0 ? (
                <p className="latest-analysis-empty-copy">데이터 없음</p>
              ) : (
                <div className="latest-analysis-distribution-list">
                  {Object.entries(sourceCounts).map(([key, val]) => (
                    <div key={key} className="latest-analysis-distribution-row">
                      <div className="latest-analysis-distribution-meta">
                        <span className="latest-analysis-distribution-label">
                          {SOURCE_TYPE_LABELS[key as FindingSourceType] ?? key}
                        </span>
                        <span className="latest-analysis-distribution-count">{val}</span>
                      </div>
                      <div className="latest-analysis-distribution-bar">
                        <div
                          className={getSourceBarClass(key)}
                          style={{ width: `${(val / sourceTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
            <TopFilesCard topFiles={topFiles} onFileClick={onFileClick} />
          </div>
        </section>
      )}

      {findings.length > 0 && (
        <section className="latest-analysis-section">
          <OverviewSectionHeader title="탐지 항목" />
          <Card className="latest-analysis-card">
            <CardContent className="latest-analysis-toolbar-card">
              <div className="latest-analysis-toolbar-row">
                <div className="latest-analysis-search-wrap">
                <Search size={14} className="latest-analysis-search-icon" />
                <Input
                  type="text"
                  className="latest-analysis-search-input"
                  placeholder="탐지 항목 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="latest-analysis-filter-group">
                <Button
                  variant={sourceTypeFilter === "all" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSourceTypeFilter("all")}
                >
                  전체
                </Button>
                {(Object.entries(SOURCE_TYPE_LABELS) as [FindingSourceType, string][])
                  .filter(([key]) => sourceCounts[key])
                  .map(([key, label]) => (
                    <Button
                      key={key}
                      variant={sourceTypeFilter === key ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setSourceTypeFilter(key)}
                    >
                      {label}
                    </Button>
                  ))}
              </div>
              <div className="latest-analysis-sort-group">
                <select
                  className="latest-analysis-select"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as "severity" | "createdAt" | "location")}
                >
                  <option value="severity">심각도</option>
                  <option value="createdAt">생성일</option>
                  <option value="location">위치</option>
                </select>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  title={sortOrder === "asc" ? "오름차순" : "내림차순"}
                >
                  {sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </Button>
              </div>
            </div>

              <div className="latest-analysis-toolbar-row latest-analysis-toolbar-row--group">
                <span className="latest-analysis-toolbar-label">GROUP BY</span>
                <div className="latest-analysis-filter-group">
                  <Button
                    variant={groupBy === "severity" ? "secondary" : "outline"}
                    size="icon-sm"
                    onClick={() => setGroupBy("severity")}
                    title="심각도별"
                  >
                    <Layers size={14} />
                  </Button>
                  <Button
                    variant={groupBy === "file" ? "secondary" : "outline"}
                    size="icon-sm"
                    onClick={() => setGroupBy("file")}
                    title="파일별"
                  >
                    <FileCode size={14} />
                  </Button>
                  <Button
                    variant={groupBy === "status" ? "secondary" : "outline"}
                    size="icon-sm"
                    onClick={() => setGroupBy("status")}
                    title="상태별"
                  >
                    <CheckSquare size={14} />
                  </Button>
                </div>
              </div>

            <div className="latest-analysis-selection-row">
              <label className="latest-analysis-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedIds.size === findings.length && findings.length > 0}
                  onChange={toggleSelectAll}
                />
                {selectedIds.size > 0 ? `${selectedIds.size}건 선택` : "전체 선택"}
              </label>
              {selectedIds.size > 0 && (
                <div className="latest-analysis-bulk-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatus("false_positive")}
                    disabled={bulkProcessing}
                  >
                    오탐 처리
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatus("accepted_risk")}
                    disabled={bulkProcessing}
                  >
                    위험 수용
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatus("fixed")}
                    disabled={bulkProcessing}
                  >
                    수정 완료
                  </Button>
                  {bulkProcessing && <Spinner size={14} />}
                </div>
              )}
            </div>
            </CardContent>
          </Card>

          {groups.length === 0 ? (
            <Card className="latest-analysis-card">
              <CardContent className="latest-analysis-empty-card-body">
                <span className="latest-analysis-empty-eyebrow">
                  {severityFilter === "all" ? "NO FINDINGS" : `NO ${severityFilter.toUpperCase()} FINDINGS`}
                </span>
                <p className="latest-analysis-empty-copy">
                  {severityFilter === "all"
                    ? "현재 조건에서 노출된 탐지 항목이 없습니다."
                    : `${SEVERITY_LABELS[severityFilter]} 심각도 필터에 걸리는 탐지 항목이 없습니다.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => (
              <Card key={group.key} className="latest-analysis-group-card">
                <CardContent className="latest-analysis-group-card-body">
                  <div className="latest-analysis-group-head">
                    {groupBy === "file" && <FileCode size={16} className="latest-analysis-group-icon" />}
                    {groupBy === "severity" && <SeverityBadge severity={group.key as Severity} size="sm" />}
                    {groupBy === "status" && <FindingStatusBadge status={group.key as FindingStatus} size="sm" />}
                    <span className="latest-analysis-group-label">{group.label}</span>
                    <span className="latest-analysis-group-count">{group.items.length} findings</span>
                  </div>
                  <div className="latest-analysis-group-list">
                    {group.items.map(({ finding }) => {
                      const line = finding.location?.includes(":") ? finding.location.split(":")[1] : null;
                      return (
                        <button
                          key={finding.id}
                          type="button"
                          className="latest-analysis-item"
                          onClick={() => onSelectFinding(finding.id)}
                        >
                          <div className="latest-analysis-item-row">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(finding.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelect(finding.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <SeverityBadge severity={finding.severity} size="sm" />
                            <FindingStatusBadge status={finding.status} size="sm" />
                            <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
                            <span className="latest-analysis-item-title">{finding.title}</span>
                            {(finding as Record<string, unknown>).fingerprint && (
                              <span
                                className="latest-analysis-fingerprint"
                                title="이전 분석에서도 발견된 취약점"
                              >
                                <History size={11} />
                              </span>
                            )}
                            {line && <span className="latest-analysis-item-line">:{line}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      )}
    </div>
  );
};
