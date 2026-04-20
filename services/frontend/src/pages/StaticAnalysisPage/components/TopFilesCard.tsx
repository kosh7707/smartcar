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
    <Card className="overall-top-files-card">
      <CardContent className="overall-top-files-card__body">
        <CardTitle>취약 파일 Top {topFiles.length}</CardTitle>
        <div className="overall-top-files-card__list">
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
                  "overall-top-files-card__row",
                  onFileClick ? "overall-top-files-card__row--clickable" : "",
                ].join(" ")}
              >
                <span className="overall-top-files-card__rank">{i + 1}</span>
                <span className="overall-top-files-card__name" title={f.filePath}>
                  {f.filePath}
                </span>
                <span className="overall-top-files-card__count">{f.findingCount}건</span>
                <SeverityBadge severity={f.topSeverity as Severity} size="sm" />
                {onFileClick && <ExternalLink size={14} className="overall-top-files-card__icon" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
