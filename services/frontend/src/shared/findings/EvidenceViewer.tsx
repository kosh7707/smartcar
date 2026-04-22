import React, { useState } from "react";
import type { EvidenceRef, LocatorType } from "@aegis/shared";
import { X } from "lucide-react";
import { ARTIFACT_TYPE_LABELS, LOCATOR_TYPE_LABELS } from "../../constants/evidence";
import { formatDateTime } from "../../utils/format";

interface RendererProps {
  evidence: EvidenceRef;
}

const LineRangeRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { file, startLine, endLine } = evidence.locator as Record<string, unknown>;
  return (
    <div className="evidence-viewer__empty">
      <div className="evidence-viewer__empty-title">소스 코드 범위</div>
      <div className="evidence-viewer__pill">{file ? String(file) : "파일 미지정"} : {String(startLine ?? "?")}-{String(endLine ?? "?")}줄</div>
      <p className="evidence-viewer__empty-copy">코드 로딩은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const PacketRangeRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { startIndex, endIndex } = evidence.locator as Record<string, unknown>;
  return (
    <div className="evidence-viewer__empty">
      <div className="evidence-viewer__empty-title">CAN 프레임 범위</div>
      <div className="evidence-viewer__pill">패킷 #{String(startIndex ?? "?")} ~ #{String(endIndex ?? "?")}</div>
      <p className="evidence-viewer__empty-copy">프레임 데이터 로딩은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const TimestampWindowRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { startTime, endTime } = evidence.locator as Record<string, unknown>;
  return (
    <div className="evidence-viewer__empty">
      <div className="evidence-viewer__empty-title">시간 범위</div>
      <div className="evidence-viewer__pill">{String(startTime ?? "?")} ~ {String(endTime ?? "?")}</div>
      <p className="evidence-viewer__empty-copy">타임라인 뷰는 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const RequestResponseRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { requestId } = evidence.locator as Record<string, unknown>;
  return (
    <div className="evidence-viewer__empty">
      <div className="evidence-viewer__empty-title">요청/응답 쌍</div>
      <div className="evidence-viewer__pill">요청 ID: {String(requestId ?? "?")}</div>
      <p className="evidence-viewer__empty-copy">상세 내용은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const FallbackRenderer: React.FC<RendererProps> = () => (
  <div className="evidence-viewer__empty">
    <div className="evidence-viewer__empty-title">미지원 유형</div>
    <p className="evidence-viewer__empty-copy">지원되지 않는 증적 유형입니다. Raw 데이터를 확인하세요.</p>
  </div>
);

const EVIDENCE_RENDERERS: Record<LocatorType, React.FC<RendererProps>> = {
  "line-range": LineRangeRenderer,
  "packet-range": PacketRangeRenderer,
  "timestamp-window": TimestampWindowRenderer,
  "request-response-pair": RequestResponseRenderer,
};

interface Props {
  evidence: EvidenceRef;
  onClose: () => void;
}

export const EvidenceViewer: React.FC<Props> = ({ evidence, onClose }) => {
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");
  const Renderer = EVIDENCE_RENDERERS[evidence.locatorType] ?? FallbackRenderer;

  return (
    <div className="evidence-viewer">
      <div className="evidence-viewer__head">
        <div className="evidence-viewer__meta">
          <span>{ARTIFACT_TYPE_LABELS[evidence.artifactType]}</span>
          <span className="evidence-viewer__label">{LOCATOR_TYPE_LABELS[evidence.locatorType]}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-icon-sm" onClick={onClose} title="닫기"><X size={16} /></button>
      </div>

      <div className="evidence-viewer__modes">
        <button className={`evidence-viewer__mode ${viewMode === "structured" ? "is-active" : ""}`} onClick={() => setViewMode("structured")}>Structured</button>
        <button className={`evidence-viewer__mode ${viewMode === "raw" ? "is-active" : ""}`} onClick={() => setViewMode("raw")}>Raw</button>
      </div>

      <div className="evidence-viewer__body">
        {viewMode === "structured" ? <Renderer evidence={evidence} /> : <pre className="evidence-viewer__raw">{JSON.stringify(evidence, null, 2)}</pre>}
      </div>

      <div className="evidence-viewer__foot">
        <span>Artifact: {ARTIFACT_TYPE_LABELS[evidence.artifactType]}</span>
        <span>Locator: {LOCATOR_TYPE_LABELS[evidence.locatorType]}</span>
        <span>ID: {evidence.artifactId}</span>
        <span>생성: {formatDateTime(evidence.createdAt)}</span>
      </div>
    </div>
  );
};
