import React, { useState } from "react";
import type { EvidenceRef } from "@aegis/shared";
import { FileCheck, ChevronDown, ChevronUp } from "lucide-react";
import { EvidenceItemRow } from "./EvidenceItemRow";
import { EmptyState } from "../ui";
import "./EvidencePanel.css";

const COLLAPSE_THRESHOLD = 5;

interface Props {
  evidenceRefs: EvidenceRef[];
  onSelectEvidence?: (evidence: EvidenceRef) => void;
}

export const EvidencePanel: React.FC<Props> = ({ evidenceRefs, onSelectEvidence }) => {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = evidenceRefs.length > COLLAPSE_THRESHOLD;
  const visibleRefs = shouldCollapse && !expanded
    ? evidenceRefs.slice(0, COLLAPSE_THRESHOLD)
    : evidenceRefs;
  const hiddenCount = evidenceRefs.length - COLLAPSE_THRESHOLD;

  return (
    <div className="panel evidence-panel">
      <div className="panel-body evidence-panel__body">
        <h3 className="panel-title evidence-panel__title">
          <FileCheck size={16} />
          증적 ({evidenceRefs.length})
        </h3>
        <p className="evidence-panel__description">
          Finding과 연결된 코드 위치 및 분석 근거
        </p>

        {evidenceRefs.length === 0 ? (
          <EmptyState compact title="연결된 증적이 없습니다" />
        ) : (
          <>
            <div className="evidence-panel__list">
              {visibleRefs.map((ref) => (
                <EvidenceItemRow
                  key={ref.id}
                  evidence={ref}
                  onClick={onSelectEvidence ? () => onSelectEvidence(ref) : undefined}
                />
              ))}
            </div>
            {shouldCollapse && (
              <button type="button" className="btn btn-ghost evidence-panel__toggle" onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded ? (
                  <>
                    <ChevronUp size={14} />
                    접기
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    나머지 {hiddenCount}건 더 보기
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
