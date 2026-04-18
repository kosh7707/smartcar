import React from "react";
import type { Severity } from "@aegis/shared";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "../../../shared/ui";

interface TopFile {
  filePath: string;
  findingCount: number;
  topSeverity: string;
}

interface Props {
  topFiles: TopFile[];
  onFileClick?: (filePath: string) => void;
}

export const TopFilesCard: React.FC<Props> = ({ topFiles, onFileClick }) => {
  if (topFiles.length === 0) return null;

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-5">
        <CardTitle>취약 파일 Top {topFiles.length}</CardTitle>
        <div className="space-y-2">
          {topFiles.map((f, i) => {
            const rowProps = onFileClick
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  onClick: () => onFileClick(f.filePath),
                  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === "Enter") onFileClick(f.filePath);
                  },
                }
              : {};
            return (
              <div
                key={f.filePath}
                {...rowProps}
                className={[
                  "flex items-center gap-3 rounded-lg border border-border/70 px-4 py-3 text-sm",
                  onFileClick ? "cursor-pointer transition-colors hover:bg-muted/40" : "",
                ].join(" ")}
              >
                <span className="w-6 shrink-0 text-sm font-semibold text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={f.filePath}>
                  {f.filePath}
                </span>
                <span className="shrink-0 font-mono text-sm text-muted-foreground">{f.findingCount}건</span>
                <SeverityBadge severity={f.topSeverity as Severity} size="sm" />
                {onFileClick && <ExternalLink size={14} className="shrink-0 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
