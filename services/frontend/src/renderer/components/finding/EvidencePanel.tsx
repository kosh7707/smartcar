import React from "react";
import type { EvidenceRef } from "@smartcar/shared";
import { FileCheck } from "lucide-react";
import { EvidenceItemRow } from "./EvidenceItemRow";
import { EmptyState } from "../ui";
import "./EvidencePanel.css";

interface Props {
  evidenceRefs: EvidenceRef[];
  onSelectEvidence?: (evidence: EvidenceRef) => void;
}

export const EvidencePanel: React.FC<Props> = ({ evidenceRefs, onSelectEvidence }) => (
  <div className="evidence-panel card">
    <div className="card-title">
      <FileCheck size={16} />
      증적 ({evidenceRefs.length})
    </div>

    {evidenceRefs.length === 0 ? (
      <EmptyState compact title="연결된 증적이 없습니다" />
    ) : (
      <div className="evidence-panel__list">
        {evidenceRefs.map((ref) => (
          <EvidenceItemRow
            key={ref.id}
            evidence={ref}
            onClick={onSelectEvidence ? () => onSelectEvidence(ref) : undefined}
          />
        ))}
      </div>
    )}
  </div>
);
