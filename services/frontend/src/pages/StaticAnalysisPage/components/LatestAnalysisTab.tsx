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
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Spinner,
  GateResultCard,
  FindingStatusBadge,
  SourceBadge,
} from "../../../shared/ui";
import { bulkUpdateFindingStatus } from "../../../api/analysis";
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

const POSTURE: Array<{ key: Exclude<Severity, "info">; label: string }> = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

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
      <div className="latest-analysis-stack" data-chore>
        <section className="chore c-1" aria-labelledby="latest-empty-head">
          <div className="section-head">
            <h2 id="latest-empty-head">최신 분석 없음</h2>
            <span className="hint">AWAITING FIRST RUN</span>
          </div>
          <div className="panel latest-analysis-empty">
            <div className="latest-analysis-empty__body">
              <div className="latest-analysis-empty__copy">
                <span className="panel-empty__eyebrow">NOTHING YET</span>
                <p className="latest-analysis-empty__headline">
                  이 프로젝트에 완료된 분석이 없습니다.
                </p>
                <p className="latest-analysis-empty__caption">
                  새 분석을 실행하면 품질 게이트 · 심각도 분포 · 탐지 항목이 여기에 채워집니다.
                </p>
              </div>
              <button type="button" className="btn btn-primary" onClick={onNewAnalysis}>
                <Plus size={14} />
                새 분석 실행
                <ArrowRight size={14} />
              </button>
            </div>
            <dl className="latest-analysis-empty__preview" aria-label="나타날 결과 미리보기">
              <div className="latest-analysis-empty__preview-cell">
                <dt>품질 게이트</dt>
                <dd>PASS · WARN · FAIL</dd>
              </div>
              <div className="latest-analysis-empty__preview-cell">
                <dt>보안 현황</dt>
                <dd>CRIT · HIGH · MED · LOW</dd>
              </div>
              <div className="latest-analysis-empty__preview-cell">
                <dt>분포</dt>
                <dd>출처 · Top 파일</dd>
              </div>
              <div className="latest-analysis-empty__preview-cell">
                <dt>탐지 항목</dt>
                <dd>파일 · 심각도 · 상태 그룹</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
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

  const totalExInfo = findings.length - severityCounts.info;

  return (
    <div className="latest-analysis-stack" data-chore>
      {gate ? (
        <section className="chore c-1" aria-labelledby="latest-gate-head">
          <div className="section-head">
            <h2 id="latest-gate-head">품질 게이트</h2>
          </div>
          <GateResultCard gate={gate} />
        </section>
      ) : (
        <section className="chore c-1" aria-labelledby="latest-gate-head">
          <div className="section-head">
            <h2 id="latest-gate-head">품질 게이트</h2>
          </div>
          <div className="panel">
            <div className="panel-empty">
              <span className="panel-empty__eyebrow">NO GATE</span>
              <p className="panel-empty__copy">Quality Gate가 설정되지 않았습니다.</p>
            </div>
          </div>
        </section>
      )}

      <section className="chore c-2" aria-labelledby="latest-posture-head">
        <div className="section-head">
          <h2 id="latest-posture-head">
            보안 현황
            <span className="count">{totalExInfo}</span>
          </h2>
          <span className="hint">
            {severityFilter === "all" ? "전체 표시 중" : "심각도 필터 적용"}
          </span>
        </div>
        <div className="severity-tally severity-tally--clickable" role="group" aria-label="심각도별 탐지 현황">
          <button
            type="button"
            className={cn(
              "severity-tally__cell severity-tally__cell--total",
              severityFilter === "all" && "is-active",
            )}
            onClick={() => setSeverityFilter("all")}
          >
            <span className="severity-tally__total-label">총 Finding</span>
            <span className="severity-tally__count">{findings.length}</span>
          </button>
          {POSTURE.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={cn(
                "severity-tally__cell",
                `severity-tally__cell--${key}`,
                severityFilter === key && "is-active",
              )}
              onClick={() => setSeverityFilter(severityFilter === key ? "all" : key)}
            >
              <span className={`sev-chip ${key}`}>
                <span className="sev-dot" aria-hidden="true" />
                {label}
              </span>
              <span className="severity-tally__count">{severityCounts[key] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      {findings.length > 0 && (
        <section className="chore c-3" aria-labelledby="latest-distribution-head">
          <div className="section-head">
            <h2 id="latest-distribution-head">분포</h2>
          </div>
          <div className="latest-analysis-distribution-grid">
            <div className="panel">
              <div className="panel-head">
                <h3>출처별 분포</h3>
              </div>
              {sourceTotal === 0 ? (
                <div className="panel-empty">
                  <span className="panel-empty__eyebrow">NO DATA</span>
                  <p className="panel-empty__copy">출처 데이터가 없습니다.</p>
                </div>
              ) : (
                <div className="distribution-list">
                  {Object.entries(sourceCounts).map(([key, val]) => (
                    <div key={key} className="distribution-row">
                      <div className="distribution-meta">
                        <span className="distribution-label">
                          {SOURCE_TYPE_LABELS[key as FindingSourceType] ?? key}
                        </span>
                        <span className="distribution-count">{val}</span>
                      </div>
                      <div className="distribution-bar">
                        <div
                          className={cn(
                            "distribution-fill",
                            key === "rule-engine" && "distribution-fill--rule",
                            key === "llm-assist" && "distribution-fill--ai",
                            key === "both" && "distribution-fill--hybrid",
                          )}
                          style={{ width: `${(val / sourceTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <TopFilesCard topFiles={topFiles} onFileClick={onFileClick} />
          </div>
        </section>
      )}

      {findings.length > 0 && (
        <section className="chore c-4" aria-labelledby="latest-findings-head">
          <div className="section-head">
            <h2 id="latest-findings-head">
              탐지 항목
              <span className="count">{filteredFindings.length}</span>
            </h2>
            <span className="hint">GROUP BY {groupBy.toUpperCase()}</span>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>필터</h3>
              <div className="panel-tools">
                <div className="search-inline">
                  <Search size={12} />
                  <input
                    type="text"
                    placeholder="탐지 항목 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="filter-pills">
                  <button
                    type="button"
                    className={cn("pill", sourceTypeFilter === "all" && "active")}
                    onClick={() => setSourceTypeFilter("all")}
                  >
                    ALL
                  </button>
                  {(Object.entries(SOURCE_TYPE_LABELS) as [FindingSourceType, string][])
                    .filter(([key]) => sourceCounts[key])
                    .map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={cn("pill", sourceTypeFilter === key && "active")}
                        onClick={() => setSourceTypeFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="panel-body panel-body--tools">
              <div className="filter-pills">
                <button
                  type="button"
                  className={cn("pill", groupBy === "severity" && "active")}
                  onClick={() => setGroupBy("severity")}
                  aria-label="심각도별 그룹"
                >
                  <Layers size={11} /> SEVERITY
                </button>
                <button
                  type="button"
                  className={cn("pill", groupBy === "file" && "active")}
                  onClick={() => setGroupBy("file")}
                  aria-label="파일별 그룹"
                >
                  <FileCode size={11} /> FILE
                </button>
                <button
                  type="button"
                  className={cn("pill", groupBy === "status" && "active")}
                  onClick={() => setGroupBy("status")}
                  aria-label="상태별 그룹"
                >
                  <CheckSquare size={11} /> STATUS
                </button>
              </div>
              <div className="filter-sort-wrap">
                <select
                  className="filter-select"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as "severity" | "createdAt" | "location")}
                >
                  <option value="severity">심각도순</option>
                  <option value="createdAt">생성일순</option>
                  <option value="location">위치순</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  aria-label={sortOrder === "asc" ? "오름차순" : "내림차순"}
                >
                  {sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </button>
              </div>
            </div>

            <div className="panel-body panel-body--selection">
              <label className="selection-label">
                <input
                  type="checkbox"
                  checked={selectedIds.size === findings.length && findings.length > 0}
                  onChange={toggleSelectAll}
                />
                <span>{selectedIds.size > 0 ? `${selectedIds.size}건 선택` : "전체 선택"}</span>
              </label>
              {selectedIds.size > 0 && (
                <div className="selection-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleBulkStatus("false_positive")}
                    disabled={bulkProcessing}
                  >
                    오탐 처리
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleBulkStatus("accepted_risk")}
                    disabled={bulkProcessing}
                  >
                    위험 수용
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleBulkStatus("fixed")}
                    disabled={bulkProcessing}
                  >
                    수정 완료
                  </button>
                  {bulkProcessing && <Spinner size={14} />}
                </div>
              )}
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="panel">
              <div className="panel-empty">
                <span className="panel-empty__eyebrow">
                  {severityFilter === "all" ? "NO FINDINGS" : `NO ${severityFilter.toUpperCase()} FINDINGS`}
                </span>
                <p className="panel-empty__copy">
                  {severityFilter === "all"
                    ? "현재 조건에서 노출된 탐지 항목이 없습니다."
                    : `${SEVERITY_LABELS[severityFilter]} 심각도 필터에 걸리는 탐지 항목이 없습니다.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="finding-groups">
              {groups.map((group) => (
                <div key={group.key} className="panel finding-group">
                  <div className="panel-head">
                    <h3>
                      {groupBy === "file" && <FileCode aria-hidden="true" />}
                      {groupBy === "severity" && (
                        <span className={`sev-chip ${group.key}`}>
                          <span className="sev-dot" aria-hidden="true" />
                          {group.label}
                        </span>
                      )}
                      {groupBy === "status" && <FindingStatusBadge status={group.key as FindingStatus} size="sm" />}
                      {groupBy !== "severity" && <span className="finding-group__file">{group.label}</span>}
                      <span className="count">{group.items.length}</span>
                    </h3>
                  </div>
                  <ul className="finding-list">
                    {group.items.map(({ finding }) => {
                      const line = finding.location?.includes(":")
                        ? finding.location.split(":")[1]
                        : null;
                      return (
                        <li key={finding.id} className="finding-row">
                          <div className="finding-row__select">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(finding.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelect(finding.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <button
                            type="button"
                            className="finding-row__btn"
                            onClick={() => onSelectFinding(finding.id)}
                          >
                            <span className={`sev-chip ${finding.severity}`}>
                              <span className="sev-dot" aria-hidden="true" />
                              {finding.severity.toUpperCase()}
                            </span>
                            <FindingStatusBadge status={finding.status} size="sm" />
                            <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
                            <span className="finding-row__title">{finding.title}</span>
                            {(finding as Record<string, unknown>).fingerprint && (
                              <span
                                className="finding-row__fingerprint"
                                title="이전 분석에서도 발견된 취약점"
                              >
                                <History size={11} />
                              </span>
                            )}
                            {line && <span className="finding-row__line">:{line}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
