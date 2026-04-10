import React from "react";
import type { Severity } from "@aegis/shared";
import { ExternalLink } from "lucide-react";
import { SeverityBadge } from "../ui";

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
    <div className="card">
      <div className="card-title">취약 파일 Top {topFiles.length}</div>
      <div className="ranking-table">
        {topFiles.map((f, i) => (
          <div
            key={f.filePath}
            className={`ranking-table__row${onFileClick ? " ranking-table__row--clickable" : ""}`}
            onClick={onFileClick ? () => onFileClick(f.filePath) : undefined}
            role={onFileClick ? "button" : undefined}
            tabIndex={onFileClick ? 0 : undefined}
            onKeyDown={onFileClick ? (e) => { if (e.key === "Enter") onFileClick(f.filePath); } : undefined}
          >
            <span className="ranking-table__rank">{i + 1}</span>
            <span className="ranking-table__name" title={f.filePath}>{f.filePath}</span>
            <span className="ranking-table__value">{f.findingCount}건</span>
            <SeverityBadge severity={f.topSeverity as Severity} size="sm" />
            {onFileClick && <ExternalLink size={14} className="ranking-table__link-icon" />}
          </div>
        ))}
      </div>
    </div>
  );
};
