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
    <Card className="fpage-summary shadow-none">
      <CardContent className="space-y-3">
        <div className="fpage-langbar">
          {langStats.map((item) => (
            <div
              key={item.group}
              className="fpage-langbar__segment"
              style={{
                width: `${(item.count / totalFiles) * 100}%`,
                background: item.color,
              }}
              title={`${item.group}: ${item.count}`}
            />
          ))}
        </div>
        <div className="fpage-langbar__legend">
          {langStats.map((item) => (
            <div key={item.group} className="fpage-langbar__legend-item">
              <span
                className="fpage-langbar__dot"
                style={{ background: item.color }}
              />
              <span className="fpage-langbar__legend-label">{item.group}</span>
              <span className="fpage-langbar__legend-value">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
