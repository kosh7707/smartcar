import React, { useState } from "react";
import type { EvidenceRef, LocatorType } from "@aegis/shared";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARTIFACT_TYPE_LABELS, LOCATOR_TYPE_LABELS } from "../../constants/evidence";
import { formatDateTime } from "../../utils/format";

/* ── Renderer 인터페이스 ── */

interface RendererProps {
  evidence: EvidenceRef;
}

/* ── 스켈레톤 렌더러 (API 연동 전 플레이스홀더) ── */

const LineRangeRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { file, startLine, endLine } = evidence.locator as Record<string, unknown>;
  return (
    <div className="py-5 text-center">
      <div className="mb-3 text-base font-semibold text-foreground">소스 코드 범위</div>
      <div className="mb-3 inline-block rounded-lg bg-background/90 px-4 py-2 font-mono text-sm text-muted-foreground">
        {file ? String(file) : "파일 미지정"} : {String(startLine ?? "?")}-{String(endLine ?? "?")}줄
      </div>
      <p className="m-0 text-sm text-muted-foreground">코드 로딩은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const PacketRangeRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { startIndex, endIndex } = evidence.locator as Record<string, unknown>;
  return (
    <div className="py-5 text-center">
      <div className="mb-3 text-base font-semibold text-foreground">CAN 프레임 범위</div>
      <div className="mb-3 inline-block rounded-lg bg-background/90 px-4 py-2 font-mono text-sm text-muted-foreground">
        패킷 #{String(startIndex ?? "?")} ~ #{String(endIndex ?? "?")}
      </div>
      <p className="m-0 text-sm text-muted-foreground">프레임 데이터 로딩은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const TimestampWindowRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { startTime, endTime } = evidence.locator as Record<string, unknown>;
  return (
    <div className="py-5 text-center">
      <div className="mb-3 text-base font-semibold text-foreground">시간 범위</div>
      <div className="mb-3 inline-block rounded-lg bg-background/90 px-4 py-2 font-mono text-sm text-muted-foreground">
        {String(startTime ?? "?")} ~ {String(endTime ?? "?")}
      </div>
      <p className="m-0 text-sm text-muted-foreground">타임라인 뷰는 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const RequestResponseRenderer: React.FC<RendererProps> = ({ evidence }) => {
  const { requestId } = evidence.locator as Record<string, unknown>;
  return (
    <div className="py-5 text-center">
      <div className="mb-3 text-base font-semibold text-foreground">요청/응답 쌍</div>
      <div className="mb-3 inline-block rounded-lg bg-background/90 px-4 py-2 font-mono text-sm text-muted-foreground">
        요청 ID: {String(requestId ?? "?")}
      </div>
      <p className="m-0 text-sm text-muted-foreground">상세 내용은 API 연동 후 지원됩니다.</p>
    </div>
  );
};

const FallbackRenderer: React.FC<RendererProps> = ({ evidence }) => (
  <div className="py-5 text-center">
    <div className="mb-3 text-base font-semibold text-foreground">미지원 유형</div>
    <p className="m-0 text-sm text-muted-foreground">
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
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-gradient-to-b from-background to-muted/50">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {ARTIFACT_TYPE_LABELS[evidence.artifactType]}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">
            {LOCATOR_TYPE_LABELS[evidence.locatorType]}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} title="닫기">
          <X size={16} />
        </Button>
      </div>

      {/* 뷰 모드 토글 */}
      <div className="flex border-b border-border">
        <button
          className={cn(
            "flex-1 border-b-2 border-transparent px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            viewMode === "structured" && "border-primary text-primary",
          )}
          onClick={() => setViewMode("structured")}
        >
          Structured
        </button>
        <button
          className={cn(
            "flex-1 border-b-2 border-transparent px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            viewMode === "raw" && "border-primary text-primary",
          )}
          onClick={() => setViewMode("raw")}
        >
          Raw
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="min-h-30 p-5">
        {viewMode === "structured" ? (
          <Renderer evidence={evidence} />
        ) : (
          <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-background/90 p-4 font-mono text-sm text-muted-foreground">
            {JSON.stringify(evidence, null, 2)}
          </pre>
        )}
      </div>

      {/* 메타데이터 */}
      <div className="flex flex-wrap gap-4 border-t border-border px-5 py-4 text-sm text-muted-foreground">
        <span>Artifact: {ARTIFACT_TYPE_LABELS[evidence.artifactType]}</span>
        <span>Locator: {LOCATOR_TYPE_LABELS[evidence.locatorType]}</span>
        <span>ID: {evidence.artifactId}</span>
        <span>생성: {formatDateTime(evidence.createdAt)}</span>
      </div>
    </div>
  );
};
