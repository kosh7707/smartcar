import React, { useState } from "react";
import type { EvidenceRef, LocatorType } from "@aegis/shared";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ARTIFACT_TYPE_LABELS, LOCATOR_TYPE_LABELS } from "../../constants/evidence";
import { formatDateTime } from "../../utils/format";
import "./EvidenceViewer.css";

/* ── Renderer 인터페이스 ── */

interface RendererProps {
  evidence: EvidenceRef;
}

/* ── 스켈레톤 렌더러 (API 연동 전 플레이스홀더) ── */

const LineRangeRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { file, startLine, endLine } = evidence.locator as Record<string, unknown>;
  return (
    <div className="evidence-renderer-placeholder">
      <div className="evidence-renderer-placeholder__label">소스 코드 범위</div>
      <div className="evidence-renderer-placeholder__detail">
        {file ? String(file) : "파일 미지정"} : {String(startLine ?? "?")}-{String(endLine ?? "?")}줄
      </div>
      <p className="evidence-renderer-placeholder__note">코드 로딩은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const PacketRangeRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { startIndex, endIndex } = evidence.locator as Record<string, unknown>;
  return (
    <div className="evidence-renderer-placeholder">
      <div className="evidence-renderer-placeholder__label">CAN 프레임 범위</div>
      <div className="evidence-renderer-placeholder__detail">
        패킷 #{String(startIndex ?? "?")} ~ #{String(endIndex ?? "?")}
      </div>
      <p className="evidence-renderer-placeholder__note">프레임 데이터 로딩은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const TimestampWindowRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { startTime, endTime } = evidence.locator as Record<string, unknown>;
  return (
    <div className="evidence-renderer-placeholder">
      <div className="evidence-renderer-placeholder__label">시간 범위</div>
      <div className="evidence-renderer-placeholder__detail">
        {String(startTime ?? "?")} ~ {String(endTime ?? "?")}
      </div>
      <p className="evidence-renderer-placeholder__note">타임라인 뷰는 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const RequestResponseRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { requestId } = evidence.locator as Record<string, unknown>;
  return (
    <div className="evidence-renderer-placeholder">
      <div className="evidence-renderer-placeholder__label">요청/응답 쌍</div>
      <div className="evidence-renderer-placeholder__detail">
        요청 ID: {String(requestId ?? "?")}
      </div>
      <p className="evidence-renderer-placeholder__note">상세 내용은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const FallbackRenderer: React.FC<RendererProps> = ({ evidence }) => (
  <div className="evidence-renderer-placeholder">
    <div className="evidence-renderer-placeholder__label">미지원 유형</div>
    <p className="evidence-renderer-placeholder__note">
      지원되지 않는 증적 유형입니다. Raw 데이터를 확인하세요.
    </p>
  </div>
);

/* ── 렌더러 레지스트리 ── */

const EVIDENCE_RENDERERS: Record<LocatorType, React.FC<RendererProps>> = {
  "line-range": LineRangeRenderer,
  "packet-range": PacketRangeRenderer,
  "timestamp-window": TimestampWindowRenderer,
  "request-response-pair": RequestResponseRenderer,
};

/* ── EvidenceViewer 본체 ── */

interface Props {
  evidence: EvidenceRef;
  onClose: () => void;
}

export const EvidenceViewer: React.FC<Props> = ({ evidence, onClose }) => {
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");

  const Renderer = EVIDENCE_RENDERERS[evidence.locatorType] ?? FallbackRenderer;

  return (
    <div className="evidence-viewer">
      {/* 헤더 */}
      <div className="evidence-viewer__header">
        <div className="evidence-viewer__header-left">
          <Badge variant="outline" className="text-xs">
            {ARTIFACT_TYPE_LABELS[evidence.artifactType]}
          </Badge>
          <span className="evidence-viewer__locator-label">
            {LOCATOR_TYPE_LABELS[evidence.locatorType]}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} title="닫기">
          <X size={16} />
        </Button>
      </div>

      {/* 뷰 모드 토글 */}
      <div className="evidence-viewer__tabs">
        <button
          className={`evidence-viewer__tab${viewMode === "structured" ? " evidence-viewer__tab--active" : ""}`}
          onClick={() => setViewMode("structured")}
        >
          Structured
        </button>
        <button
          className={`evidence-viewer__tab${viewMode === "raw" ? " evidence-viewer__tab--active" : ""}`}
          onClick={() => setViewMode("raw")}
        >
          Raw
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="evidence-viewer__content">
        {viewMode === "structured" ? (
          <Renderer evidence={evidence} />
        ) : (
          <pre className="evidence-viewer__raw">
            {JSON.stringify(evidence, null, 2)}
          </pre>
        )}
      </div>

      {/* 메타데이터 */}
      <div className="evidence-viewer__meta">
        <span>Artifact: {ARTIFACT_TYPE_LABELS[evidence.artifactType]}</span>
        <span>Locator: {LOCATOR_TYPE_LABELS[evidence.locatorType]}</span>
        <span>ID: {evidence.artifactId}</span>
        <span>생성: {formatDateTime(evidence.createdAt)}</span>
      </div>
    </div>
  );
};
