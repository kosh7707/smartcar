import React from "react";
import type { Severity } from "@aegis/shared";
import { ChevronRight } from "lucide-react";
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
    <div className="panel overall-top-files">
      <div className="panel-head">
        <h3>취약 파일 Top {topFiles.length}</h3>
      </div>
      <div className="panel-body panel-body--flush">
        <ol className="rank-list">
          {topFiles.map((f, i) => {
            const interactive = Boolean(onFileClick);
            const handleActivate = () => onFileClick?.(f.filePath);
            return (
              <li key={f.filePath} className="rank-list__item">
                <div
                  className={`rank-row${interactive ? " rank-row--clickable" : ""}`}
                  {...(interactive
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onClick: handleActivate,
                        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleActivate();
                          }
                        },
                      }
                    : {})}
                >
                  <span className="rank-row__index" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="rank-row__primary rank-row__primary--path" title={f.filePath}>
                    {f.filePath}
                  </span>
                  <span className="rank-row__count">{f.findingCount}건</span>
                  <SeverityBadge severity={f.topSeverity as Severity} size="sm" />
                  {interactive && <ChevronRight size={14} className="rank-row__chev" aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
