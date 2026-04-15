import React, { useEffect, useState, useCallback } from "react";
import "./FindingDetailView.css";
import type { Finding, EvidenceRef, AuditLogEntry, FindingStatus } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  BackButton,
  Spinner,
  SeverityBadge,
  FindingStatusBadge,
  ConfidenceBadge,
  SourceBadge,
  StateTransitionDialog,
} from "../ui";
import { EvidencePanel } from "./EvidencePanel";
import { EvidenceViewer } from "./EvidenceViewer";
import { fetchFindingDetail, updateFindingStatus, generatePoc, fetchFindingHistory, logError } from "../../api/client";
import type { PocResponse, FindingHistoryEntry } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/format";
import { renderMarkdown } from "../../utils/markdown";

interface Props {
  findingId: string;
  projectId: string;
  onBack: () => void;
}

export const FindingDetailView: React.FC<Props> = ({ findingId, projectId, onBack }) => {
  const toast = useToast();
  const [finding, setFinding] = useState<(Finding & { evidenceRefs: EvidenceRef[]; auditLog: AuditLogEntry[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRef | null>(null);

  // PoC state
  const [pocData, setPocData] = useState<PocResponse | null>(null);
  const [pocLoading, setPocLoading] = useState(false);

  // Fingerprint history
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
    fetchFindingHistory(findingId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [loadDetail, findingId]);

  const handleStatusChange = async (newStatus: FindingStatus, reason: string) => {
    if (!finding) return;
    try {
      const updated = await updateFindingStatus(finding.id, newStatus, reason);
      setFinding((prev) => prev ? { ...prev, ...updated } : null);
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
      <div className="page-enter">
        <BackButton onClick={onBack} />
        <div className="centered-loader--compact">
          <Spinner label="Finding 로딩 중..." />
        </div>
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="page-enter">
        <BackButton onClick={onBack} />
        <p className="text-tertiary">Finding을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const canGeneratePoc = finding.sourceType === "agent";

  return (
    <div className="page-enter">
      <BackButton onClick={onBack} label="뒤로" />
      <p className="finding-detail-breadcrumb">정적 분석 › Finding 상세</p>

      {/* Header: severity banner */}
      <Card
        className="finding-banner shadow-none"
        data-severity={finding.severity}
      >
        <CardContent>
        <div className="finding-banner__badges">
          <SeverityBadge severity={finding.severity} />
          <FindingStatusBadge status={finding.status} />
          <ConfidenceBadge confidence={finding.confidence} sourceType={finding.sourceType} confidenceScore={finding.confidenceScore} />
          <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
          {finding.cweId && (
            <Badge
              asChild
              variant="outline"
              className="badge-cwe"
            >
            <a
              href={`https://cwe.mitre.org/data/definitions/${finding.cweId.replace("CWE-", "")}.html`}
              target="_blank"
              rel="noopener noreferrer"
              title={`MITRE ${finding.cweId} 상세`}
              onClick={(e) => e.stopPropagation()}
            >
              {finding.cweId}
            </a>
            </Badge>
          )}
          {finding.cveIds && finding.cveIds.length > 0 && finding.cveIds.map((cve) => (
            <Badge
              key={cve}
              asChild
              variant="outline"
              className="badge-cve"
            >
            <a
              href={`https://nvd.nist.gov/vuln/detail/${cve}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`NVD ${cve} 상세`}
              onClick={(e) => e.stopPropagation()}
            >
              {cve}
            </a>
            </Badge>
          ))}
          {finding.fingerprint && (
            <span className="fingerprint-badge" title="이전 분석에서도 발견된 취약점 (fingerprint 추적)">
              재발견{history.length > 1 ? ` (${history.length}회)` : ""}
            </span>
          )}
          <h2 className="finding-banner__title">
            {finding.title}
          </h2>
        </div>
        </CardContent>
      </Card>

      {/* Status change + PoC button */}
      <div className="finding-actions">
        <Button variant="outline" onClick={() => setShowTransition(true)}>
          상태 변경
        </Button>
        {canGeneratePoc && !pocData && (
          <Button
            variant="outline"
            onClick={handleGeneratePoc}
            disabled={pocLoading}
          >
            {pocLoading ? <Spinner size={14} /> : null}
            PoC 생성
          </Button>
        )}
        {finding.location && (
          <span className="detail-meta-item">
            {finding.location}
          </span>
        )}
      </div>

      {/* Description */}
      <Card className="shadow-none">
        <CardContent className="space-y-3">
        <CardTitle>설명</CardTitle>
        <p className="finding-body-text">{finding.description}</p>
        </CardContent>
      </Card>

      {/* Detail (Agent deep analysis — markdown) */}
      {finding.detail && (
        <Card className="shadow-none">
          <CardContent className="space-y-3">
          <CardTitle>상세 분석</CardTitle>
          <div className="finding-detail-md">
            {renderMarkdown(finding.detail)}
          </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestion + fixCode */}
      {finding.suggestion && (
        <Card className="shadow-none">
          <CardContent className="space-y-3">
          <CardTitle>수정 가이드</CardTitle>
          <p className="finding-suggestion-text">
            {finding.suggestion}
          </p>
          </CardContent>
        </Card>
      )}

      {/* PoC result */}
      {pocLoading && (
        <Card className="poc-section shadow-none">
          <CardContent className="space-y-3">
          <CardTitle>PoC 생성 중...</CardTitle>
          <div className="poc-loading">
            <Spinner label="LLM이 PoC 코드를 생성하고 있습니다..." />
          </div>
          </CardContent>
        </Card>
      )}

      {pocData && (
        <Card className="poc-section shadow-none">
          <CardContent className="space-y-3">
          <div className="poc-header">
            <CardTitle className="poc-header__title">
              PoC — {pocData.poc.statement}
            </CardTitle>
          </div>
          <div className="finding-detail-md">
            {renderMarkdown(pocData.poc.detail)}
          </div>
          <div className="poc-audit">
            <span className="poc-audit-item">
              {(pocData.audit.latencyMs / 1000).toFixed(1)}초
            </span>
            <span className="poc-audit-item">
              {pocData.audit.tokenUsage.prompt + pocData.audit.tokenUsage.completion} tokens
            </span>
          </div>
          </CardContent>
        </Card>
      )}

      {/* Evidence Panel */}
      <EvidencePanel
        evidenceRefs={finding.evidenceRefs}
        onSelectEvidence={setSelectedEvidence}
      />

      {/* Fingerprint History */}
      {history.length > 1 && (
        <Card className="shadow-none">
          <CardContent className="space-y-3">
          <CardTitle>발견 이력 ({history.length}회)</CardTitle>
          <div className="audit-timeline">
            {history.map((h) => (
              <div key={h.findingId} className="audit-entry">
                <span className="audit-entry__time">{formatDateTime(h.createdAt)}</span>
                <span className="audit-entry__body">
                  Run {h.runId.slice(0, 8)} — 상태: {h.status}
                </span>
              </div>
            ))}
          </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Timeline */}
      {finding.auditLog.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="space-y-3">
          <CardTitle>감사 로그</CardTitle>
          <div className="audit-timeline">
            {finding.auditLog.map((entry) => (
              <div
                key={entry.id}
                className="audit-timeline__entry"
              >
                <span className="text-tertiary audit-timeline__time">
                  {formatDateTime(entry.timestamp)}
                </span>
                <span>
                  <strong>{entry.actor}</strong> — {entry.action}
                  {entry.detail?.from && entry.detail?.to && (
                    <span className="text-tertiary"> ({String(entry.detail.from)} → {String(entry.detail.to)})</span>
                  )}
                  {entry.detail?.reason && (
                    <span className="text-tertiary"> "{String(entry.detail.reason)}"</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          </CardContent>
        </Card>
      )}

      {/* State transition dialog */}
      <StateTransitionDialog
        open={showTransition}
        currentStatus={finding.status}
        sourceType={finding.sourceType}
        onConfirm={handleStatusChange}
        onCancel={() => setShowTransition(false)}
      />

      {/* Evidence viewer */}
      {selectedEvidence && (
        <EvidenceViewer
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
};
