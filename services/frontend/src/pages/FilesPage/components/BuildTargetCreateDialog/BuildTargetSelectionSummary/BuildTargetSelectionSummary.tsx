import "./BuildTargetSelectionSummary.css";
import React from "react";
import { formatFileSize } from "@/common/utils/format";

interface BuildTargetSelectionSummaryProps {
  selectedCount: number;
  selectedSize: number;
}

export const BuildTargetSelectionSummary: React.FC<BuildTargetSelectionSummaryProps> = ({
  selectedCount,
  selectedSize,
}) => (
  <div className="build-target-create-dialog__selection-summary">
    선택: <strong className="build-target-create-dialog__selection-count">{selectedCount}개 파일</strong>
    {selectedSize > 0 ? <> · {formatFileSize(selectedSize)}</> : null}
  </div>
);
