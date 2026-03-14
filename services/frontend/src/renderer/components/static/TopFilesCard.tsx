import React from "react";
import type { Severity } from "@smartcar/shared";
import { SeverityBadge } from "../ui";

interface TopFile {
  filePath: string;
  findingCount: number;
  topSeverity: string;
}

interface Props {
  topFiles: TopFile[];
}

export const TopFilesCard: React.FC<Props> = ({ topFiles }) => {
  if (topFiles.length === 0) return null;

  return (
    <div className="card">
      <div className="card-title">취약 파일 Top {topFiles.length}</div>
      <div className="ranking-table">
        {topFiles.map((f, i) => (
          <div key={f.filePath} className="ranking-table__row">
            <span className="ranking-table__rank">{i + 1}</span>
            <span className="ranking-table__name" title={f.filePath}>{f.filePath}</span>
            <span className="ranking-table__value">{f.findingCount}건</span>
            <SeverityBadge severity={f.topSeverity as Severity} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
};
