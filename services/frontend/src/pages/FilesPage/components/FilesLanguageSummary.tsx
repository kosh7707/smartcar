import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface FilesLanguageSummaryProps {
  totalFiles: number;
  langStats: Array<{ group: string; count: number; color: string }>;
}

export const FilesLanguageSummary: React.FC<FilesLanguageSummaryProps> = ({
  totalFiles,
  langStats,
}) => {
  if (langStats.length === 0) return null;

  return (
    <Card className="files-language-summary-card">
      <CardContent className="files-language-summary-card__body">
        <div className="files-language-summary-card__bar">
          {langStats.map((item) => (
            <div
              key={item.group}
              className="files-language-summary-card__segment"
              style={{
                width: `${(item.count / totalFiles) * 100}%`,
                background: item.color,
              }}
              title={`${item.group}: ${item.count}`}
            />
          ))}
        </div>
        <div className="files-language-summary-card__legend">
          {langStats.map((item) => (
            <div key={item.group} className="files-language-summary-card__legend-item">
              <span
                className="files-language-summary-card__legend-dot"
                style={{ background: item.color }}
              />
              <span className="files-language-summary-card__legend-label">{item.group}</span>
              <span className="files-language-summary-card__legend-count">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
