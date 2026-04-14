import React from "react";
import type { AnalysisResult } from "@aegis/shared";
import { FileSearch } from "lucide-react";
import { ListItem, SeveritySummary } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";

interface FileDetailAnalysisHistorySectionProps {
  analyses: AnalysisResult[];
  onOpenAnalysis: (analysisId: string) => void;
}

export const FileDetailAnalysisHistorySection: React.FC<FileDetailAnalysisHistorySectionProps> = ({
  analyses,
  onOpenAnalysis,
}) => (
  <section className="card file-detail-section-card">
    <div className="file-detail-section-title">
      <FileSearch size={16} />
      관련 분석 이력 ({analyses.length})
    </div>
    {analyses.length === 0 ? (
      <p className="file-detail-empty-copy">이 파일이 포함된 분석 이력이 없습니다.</p>
    ) : (
      <div>
        {analyses.map((analysis) => (
          <ListItem
            key={analysis.id}
            onClick={() => onOpenAnalysis(analysis.id)}
            trailing={<span className="file-detail-analysis-time">{formatDateTime(analysis.createdAt)}</span>}
          >
            <div className="file-detail-analysis-row">
              <span className="file-detail-analysis-title">취약점 {analysis.summary.total}건</span>
              <SeveritySummary summary={analysis.summary} />
            </div>
          </ListItem>
        ))}
      </div>
    )}
  </section>
);
