import React, { useEffect, useState, useCallback, useRef } from "react";
import type { Finding, EvidenceRef, AuditLogEntry, FindingStatus } from "@aegis/shared";
import { MapPin, Copy, Clock, FlaskConical, Timer, Cpu, History } from "lucide-react";
import {
  BackButton,
  Spinner,
  SeverityBadge,
  FindingStatusBadge,
  ConfidenceBadge,
  SourceBadge,
  StateTransitionDialog,
} from "../ui";
import { EvidencePanel } from "../finding/EvidencePanel";
import { EvidenceViewer } from "../finding/EvidenceViewer";
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
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // PoC state
  const [pocData, setPocData] = useState<PocResponse | null>(null);
  const [pocLoading, setPocLoading] = useState(false);

  // Fingerprint history
  const [history, setHistory] = useState<FindingHistoryEntry[]>([]);

  const loadDetail = useCallback(async () => {
    try {
      const data = await fetchFindingDetail(findingId);
      setFinding(data);
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
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
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

  const handleCopyCode = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, []);

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
      <p className="text-sm text-tertiary" style={{ margin: "0 0 var(--space-3) 0" }}>정적 분석 › Finding 상세</p>

      {/* Header: severity banner */}
      <div
        className="card finding-banner"
        data-severity={finding.severity}
      >
        <div className="finding-banner__badges">
          <SeverityBadge severity={finding.severity} />
          <FindingStatusBadge status={finding.status} />
          <ConfidenceBadge confidence={finding.confidence} />
          <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
          {(finding as Record<string, unknown>).fingerprint && (
            <span className="fingerprint-badge" title="이전 분석에서도 발견된 취약점 (fingerprint 추적)">
              <History size={12} /> 재발견{history.length > 1 ? ` (${history.length}회)` : ""}
            </span>
          )}
          <h2 className="finding-banner__title">
            {finding.title}
          </h2>
        </div>
      </div>

      {/* Status change + PoC button */}
      <div className="finding-actions">
        <button className="btn btn-secondary" onClick={() => setShowTransition(true)}>
          상태 변경
        </button>
        {canGeneratePoc && !pocData && (
          <button
            className="btn btn-secondary"
            onClick={handleGeneratePoc}
            disabled={pocLoading}
          >
            {pocLoading ? <Spinner size={14} /> : <FlaskConical size={14} />}
            PoC 생성
          </button>
        )}
        {finding.location && (
          <span className="detail-meta-item">
            <MapPin size={14} />
            {finding.location}
          </span>
        )}
      </div>

      {/* Description */}
      <div className="card">
        <div className="card-title">설명</div>
        <p className="finding-body-text">{finding.description}</p>
      </div>

      {/* Detail (Agent deep analysis — markdown) */}
      {finding.detail && (
        <div className="card">
          <div className="card-title">상세 분석</div>
          <div className="finding-detail-md">
            {renderMarkdown(finding.detail)}
          </div>
        </div>
      )}

      {/* Suggestion + fixCode */}
      {finding.suggestion && (
        <div className="card">
          <div className="card-title">수정 가이드</div>
          <p className="finding-suggestion-text">
            {finding.suggestion}
          </p>
        </div>
      )}

      {/* PoC result */}
      {pocLoading && (
        <div className="card poc-section">
          <div className="card-title">
            <FlaskConical size={16} />
            PoC 생성 중...
          </div>
          <div className="poc-loading">
            <Spinner label="LLM이 PoC 코드를 생성하고 있습니다..." />
          </div>
        </div>
      )}

      {pocData && (
        <div className="card poc-section">
          <div className="poc-header">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <FlaskConical size={16} />
              PoC — {pocData.poc.statement}
            </div>
          </div>
          <div className="finding-detail-md">
            {renderMarkdown(pocData.poc.detail)}
          </div>
          <div className="poc-audit">
            <span className="poc-audit-item">
              <Timer size={12} />
              {(pocData.audit.latencyMs / 1000).toFixed(1)}초
            </span>
            <span className="poc-audit-item">
              <Cpu size={12} />
              {pocData.audit.tokenUsage.prompt + pocData.audit.tokenUsage.completion} tokens
            </span>
          </div>
        </div>
      )}

      {/* Evidence Panel */}
      <EvidencePanel
        evidenceRefs={finding.evidenceRefs}
        onSelectEvidence={setSelectedEvidence}
      />

      {/* Fingerprint History */}
      {history.length > 1 && (
        <div className="card">
          <div className="card-title">
            <History size={16} />
            발견 이력 ({history.length}회)
          </div>
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
        </div>
      )}

      {/* Audit Log Timeline */}
      {finding.auditLog.length > 0 && (
        <div className="card">
          <div className="card-title">
            <Clock size={16} />
            감사 로그
          </div>
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
        </div>
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
