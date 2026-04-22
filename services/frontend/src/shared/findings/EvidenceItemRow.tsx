import React from "react";
import type { EvidenceRef } from "@aegis/shared";
import { ChevronRight } from "lucide-react";
import { ARTIFACT_TYPE_LABELS, LOCATOR_TYPE_LABELS } from "../../constants/evidence";
import { formatDateTime } from "../../utils/format";

interface Props {
  evidence: EvidenceRef;
  onClick?: () => void;
}

function getLocatorSummary(evidence: EvidenceRef): string {
  const loc = evidence.locator;
  switch (evidence.locatorType) {
    case "line-range": {
      const start = loc.startLine ?? "?";
      const end = loc.endLine ?? "?";
      return `${start}-${end}줄`;
    }
    case "packet-range": {
      const start = loc.startIndex ?? "?";
      const end = loc.endIndex ?? "?";
      return `패킷 ${start}-${end}`;
    }
    case "timestamp-window": {
      const start = loc.startTime ?? "?";
      const end = loc.endTime ?? "?";
      return `${start} ~ ${end}`;
    }
    case "request-response-pair":
      return `요청 ${loc.requestId ?? "?"}`;
    default:
      return "";
  }
}

export const EvidenceItemRow: React.FC<Props> = ({ evidence, onClick }) => (
  <div
    className={`list-item list-item--divider evidence-item-row${onClick ? " list-item--clickable" : ""}`}
    onClick={onClick}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
  >
    <div className="evidence-item">
      <span className="evidence-item__artifact">
        {ARTIFACT_TYPE_LABELS[evidence.artifactType]}
      </span>
      <span className="evidence-item__locator">
        {LOCATOR_TYPE_LABELS[evidence.locatorType]}
      </span>
      <span className="evidence-item__summary">
        {getLocatorSummary(evidence)}
      </span>
    </div>

    <div className="list-item__trailing">
      <span className="evidence-item__timestamp">{formatDateTime(evidence.createdAt)}</span>
      {onClick && <ChevronRight size={14} className="list-item__chevron" />}
    </div>
  </div>
);
