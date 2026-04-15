import React, { useState } from "react";
import type { EvidenceRef } from "@aegis/shared";
import { FileCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvidenceItemRow } from "./EvidenceItemRow";
import { EmptyState } from "../ui";

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
    <Card className="shadow-none">
      <CardContent className="space-y-3">
      <CardTitle className="flex items-center gap-2">
        <FileCheck size={16} />
        증적 ({evidenceRefs.length})
      </CardTitle>
      <p className="mb-3 text-xs text-muted-foreground">
        Finding과 연결된 코드 위치 및 분석 근거
      </p>

      {evidenceRefs.length === 0 ? (
        <EmptyState compact title="연결된 증적이 없습니다" />
      ) : (
        <>
          <div className="flex flex-col">
            {visibleRefs.map((ref) => (
              <EvidenceItemRow
                key={ref.id}
                evidence={ref}
                onClick={onSelectEvidence ? () => onSelectEvidence(ref) : undefined}
              />
            ))}
          </div>
          {shouldCollapse && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full justify-center gap-3 border-t border-border py-3 text-sm font-medium text-primary hover:text-primary"
              onClick={() => setExpanded((prev) => !prev)}
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
            </Button>
          )}
        </>
      )}
      </CardContent>
    </Card>
  );
};
