import React, { useEffect, useState, useCallback } from "react";
import type { Finding, EvidenceRef, AuditLogEntry, FindingStatus } from "@smartcar/shared";
import { MapPin, Copy, Clock } from "lucide-react";
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
import { fetchFindingDetail, updateFindingStatus, logError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/format";

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
    loadDetail();
  }, [findingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (newStatus: FindingStatus, reason: string) => {
    if (!finding) return;
    try {
      const updated = await updateFindingStatus(finding.id, newStatus, reason);
      setFinding((prev) => prev ? { ...prev, ...updated } : null);
      setShowTransition(false);
      toast.success("상태가 변경되었습니다.");
      // Reload to get updated auditLog
      loadDetail();
    } catch (e) {
      logError("Status update", e);
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
          <h2 className="finding-banner__title">
            {finding.title}
          </h2>
        </div>
      </div>

      {/* Status change button */}
      <div className="finding-actions">
        <button className="btn btn-secondary" onClick={() => setShowTransition(true)}>
          상태 변경
        </button>
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

      {/* Suggestion + fixCode */}
      {finding.suggestion && (
        <div className="card">
          <div className="card-title">수정 가이드</div>
          <p className="finding-suggestion-text">
            {finding.suggestion}
          </p>
        </div>
      )}

      {/* Evidence Panel */}
      <EvidencePanel
        evidenceRefs={finding.evidenceRefs}
        onSelectEvidence={setSelectedEvidence}
      />

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
