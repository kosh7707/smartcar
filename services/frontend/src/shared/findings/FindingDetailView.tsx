import React, { useEffect, useState, useCallback } from "react";
import type { Finding, EvidenceRef, AuditLogEntry, FindingStatus } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton, Spinner, SeverityBadge, FindingStatusBadge, ConfidenceBadge, SourceBadge, StateTransitionDialog } from "../ui";
import { EvidencePanel } from "./EvidencePanel";
import { EvidenceViewer } from "./EvidenceViewer";
import { fetchFindingDetail, updateFindingStatus, generatePoc, fetchFindingHistory, logError } from "../../api/client";
import type { PocResponse, FindingHistoryEntry } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/format";
import { renderMarkdown } from "../../utils/markdown";

interface Props { findingId: string; projectId: string; onBack: () => void; }

export const FindingDetailView: React.FC<Props> = ({ findingId, projectId, onBack }) => {
  const toast = useToast();
  const [finding, setFinding] = useState<(Finding & { evidenceRefs: EvidenceRef[]; auditLog: AuditLogEntry[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRef | null>(null);
  const [pocData, setPocData] = useState<PocResponse | null>(null);
  const [pocLoading, setPocLoading] = useState(false);
  const [history, setHistory] = useState<FindingHistoryEntry[]>([]);

  const loadDetail = useCallback(async () => {
    try {
      const raw = await fetchFindingDetail(findingId);
      setFinding({ ...raw, evidenceRefs: raw.evidenceRefs ?? [], auditLog: raw.auditLog ?? [] });
    } catch (e) {
      logError("Finding load", e);
      toast.error("Finding 정보를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [findingId, toast]);

  useEffect(() => {
    setLoading(true);
    setPocData(null);
    setHistory([]);
    loadDetail();
    fetchFindingHistory(findingId).then(setHistory).catch(() => setHistory([]));
  }, [loadDetail, findingId]);

  const handleStatusChange = async (newStatus: FindingStatus, reason: string) => {
    if (!finding) return;
    try {
      const updated = await updateFindingStatus(finding.id, newStatus, reason);
      setFinding((prev) => (prev ? { ...prev, ...updated } : null));
      setShowTransition(false);
      toast.success("상태가 변경되었습니다.");
      loadDetail();
    } catch (e) {
      logError("Status update", e);
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  const handleGeneratePoc = useCallback(async () => {
    if (!finding) return;
    setPocLoading(true);
    try {
      const result = await generatePoc(projectId, finding.id);
      setPocData(result);
    } catch (e) {
      logError("Generate PoC", e);
      toast.error("PoC 생성에 실패했습니다.");
    } finally {
      setPocLoading(false);
    }
  }, [finding, projectId, toast]);

  if (loading) {
    return (
      <div className="finding-detail-shell">
        <BackButton onClick={onBack} />
        <div className="page-loading-shell"><Spinner label="Finding 로딩 중..." /></div>
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="finding-detail-shell">
        <BackButton onClick={onBack} />
        <p className="finding-body-text">Finding을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const canGeneratePoc = finding.sourceType === "agent";

  return (
    <div className="finding-detail-shell">
      <BackButton onClick={onBack} label="뒤로" className="finding-back-link" />
      <p className="page-meta-inline">정적 분석 › Finding 상세</p>

      <Card className="finding-banner-shell" data-severity={finding.severity}>
        <CardContent>
          <div className="finding-banner__badges">
            <SeverityBadge severity={finding.severity} />
            <FindingStatusBadge status={finding.status} />
            <ConfidenceBadge confidence={finding.confidence} sourceType={finding.sourceType} confidenceScore={finding.confidenceScore} />
            <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
            {finding.cweId ? (
              <Badge asChild variant="outline" className="badge-cwe"><a href={`https://cwe.mitre.org/data/definitions/${finding.cweId.replace("CWE-", "")}.html`} target="_blank" rel="noopener noreferrer" title={`MITRE ${finding.cweId} 상세`} onClick={(e) => e.stopPropagation()}>{finding.cweId}</a></Badge>
            ) : null}
            {finding.cveIds?.length ? finding.cveIds.map((cve) => (
              <Badge key={cve} asChild variant="outline" className="badge-cve"><a href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noopener noreferrer" title={`NVD ${cve} 상세`} onClick={(e) => e.stopPropagation()}>{cve}</a></Badge>
            )) : null}
            {finding.fingerprint ? <span className="finding-chip" title="이전 분석에서도 발견된 취약점 (fingerprint 추적)">재발견{history.length > 1 ? ` (${history.length}회)` : ""}</span> : null}
            <h2 className="finding-banner__title">{finding.title}</h2>
          </div>
        </CardContent>
      </Card>

      <div className="finding-actions">
        <Button variant="outline" onClick={() => setShowTransition(true)}>상태 변경</Button>
        {canGeneratePoc && !pocData ? <Button variant="outline" onClick={handleGeneratePoc} disabled={pocLoading}>{pocLoading ? <Spinner size={14} /> : null}PoC 생성</Button> : null}
        {finding.location ? <span className="finding-chip">{finding.location}</span> : null}
      </div>

      <Card className="finding-copy-card"><CardContent><div className="finding-copy-title">설명</div><p className="finding-body-text">{finding.description}</p></CardContent></Card>

      {finding.detail ? <Card className="finding-copy-card"><CardContent><div className="finding-copy-title">상세 분석</div><div className="page-section-stack">{renderMarkdown(finding.detail)}</div></CardContent></Card> : null}

      {finding.suggestion ? (
        <Card className="finding-copy-card">
          <CardContent>
            <div className="finding-copy-title">수정 가이드</div>
            <p className="finding-suggestion-text">{finding.suggestion}</p>
            {finding.fixCode ? (
              <div className="fix-code-wrap">
                <Button variant="outline" size="sm" className="fix-code-wrap__copy-btn" title="코드 복사" onClick={() => navigator.clipboard.writeText(finding.fixCode!)}>
                  복사
                </Button>
                <div className="fix-code"><code>{finding.fixCode}</code></div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {pocLoading ? <Card className="finding-copy-card"><CardContent><div className="finding-copy-title">PoC 생성 중...</div><div className="page-loading-shell"><Spinner label="LLM이 PoC 코드를 생성하고 있습니다..." /></div></CardContent></Card> : null}

      {pocData ? (
        <Card className="finding-copy-card">
          <CardContent>
            <div className="finding-copy-title">PoC — {pocData.poc.statement}</div>
            <div className="page-section-stack">{renderMarkdown(pocData.poc.detail)}</div>
            <div className="page-meta-inline"><span>{(pocData.audit.latencyMs / 1000).toFixed(1)}초</span><span>{pocData.audit.tokenUsage.prompt + pocData.audit.tokenUsage.completion} tokens</span></div>
          </CardContent>
        </Card>
      ) : null}

      <EvidencePanel evidenceRefs={finding.evidenceRefs} onSelectEvidence={setSelectedEvidence} />

      {history.length > 1 ? (
        <Card className="finding-copy-card"><CardContent><div className="finding-copy-title">발견 이력 ({history.length}회)</div><div className="audit-timeline">{history.map((h) => <div key={h.findingId} className="audit-entry"><span className="audit-entry__time">{formatDateTime(h.createdAt)}</span><span className="audit-entry__body">Run {h.runId.slice(0, 8)} — 상태: {h.status}</span></div>)}</div></CardContent></Card>
      ) : null}

      {finding.auditLog.length > 0 ? (
        <Card className="finding-copy-card"><CardContent><div className="finding-copy-title">감사 로그</div><div className="audit-timeline">{finding.auditLog.map((entry) => <div key={entry.id} className="audit-timeline__entry"><span className="audit-timeline__time">{formatDateTime(entry.timestamp)}</span><span><strong>{entry.actor}</strong> — {entry.action}{entry.detail?.from && entry.detail?.to ? <span className="finding-body-text"> ({String(entry.detail.from)} → {String(entry.detail.to)})</span> : null}{entry.detail?.reason ? <span className="finding-body-text"> "{String(entry.detail.reason)}"</span> : null}</span></div>)}</div></CardContent></Card>
      ) : null}

      {selectedEvidence ? <EvidenceViewer evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} /> : null}
      {showTransition ? <StateTransitionDialog currentStatus={finding.status} onSubmit={handleStatusChange} onCancel={() => setShowTransition(false)} /> : null}
    </div>
  );
};
