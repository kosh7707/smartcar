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
    <Card className="border-border/80 bg-card/95 shadow-none">
      <CardContent className="space-y-4 pt-4">
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {langStats.map((item) => (
            <div
              key={item.group}
              className="min-w-[2px] transition-[width]"
              style={{
                width: `${(item.count / totalFiles) * 100}%`,
                background: item.color,
              }}
              title={`${item.group}: ${item.count}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {langStats.map((item) => (
            <div key={item.group} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: item.color }}
              />
              <span className="text-sm text-muted-foreground">{item.group}</span>
              <span className="text-sm font-semibold text-foreground">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
