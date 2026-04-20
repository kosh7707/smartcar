import React from "react";
import type { AnalysisResult } from "@aegis/shared";
import { FileSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ListItem, SeveritySummary } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";

interface FileDetailAnalysisHistorySectionProps {
  analyses: AnalysisResult[];
  onOpenAnalysis: (analysisId: string) => void;
}

export const FileDetailAnalysisHistorySection: React.FC<
  FileDetailAnalysisHistorySectionProps
> = ({ analyses, onOpenAnalysis }) => (
  <section>
    <Card className="file-detail-history-card">
      <CardContent className="file-detail-history-card__body">
        <div className="file-detail-history-card__head">
          <FileSearch size={16} />
          관련 분석 이력 ({analyses.length})
        </div>
        {analyses.length === 0 ? (
          <p className="file-detail-history-card__empty">
            이 파일이 포함된 분석 이력이 없습니다.
          </p>
        ) : (
          <div className="file-detail-history-card__list">
            {analyses.map((analysis) => (
              <ListItem
                key={analysis.id}
                onClick={() => onOpenAnalysis(analysis.id)}
                trailing={
                  <span className="file-detail-history-card__time">
                    {formatDateTime(analysis.createdAt)}
                  </span>
                }
              >
                <div className="file-detail-history-card__item">
                  <span className="file-detail-history-card__summary">
                    취약점 {analysis.summary.total}건
                  </span>
                  <SeveritySummary summary={analysis.summary} />
                </div>
              </ListItem>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  </section>
);
