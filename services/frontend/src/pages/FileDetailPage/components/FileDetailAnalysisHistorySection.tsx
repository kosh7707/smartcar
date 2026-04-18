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
    <Card className="border-border/70 shadow-none">
      <CardContent className="space-y-3 py-0">
        <div className="flex items-center gap-2 border-b border-border/60 py-4 text-sm font-semibold text-foreground">
          <FileSearch size={16} />
          관련 분석 이력 ({analyses.length})
        </div>
        {analyses.length === 0 ? (
          <p className="pb-4 text-sm text-muted-foreground">
            이 파일이 포함된 분석 이력이 없습니다.
          </p>
        ) : (
          <div className="pb-2">
            {analyses.map((analysis) => (
              <ListItem
                key={analysis.id}
                onClick={() => onOpenAnalysis(analysis.id)}
                trailing={
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(analysis.createdAt)}
                  </span>
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
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
