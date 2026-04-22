import React from "react";
import { formatFileSize } from "../../../utils/format";

interface FilesLanguageSummaryProps {
  totalFiles: number;
  totalSize: number;
  langStats: Array<{ group: string; count: number; color: string }>;
}

export const FilesLanguageSummary: React.FC<FilesLanguageSummaryProps> = ({
  totalFiles,
  totalSize,
  langStats,
}) => {
  if (langStats.length === 0) return null;

  return (
    <div className="panel files-language-summary-card">
      <div className="panel-body files-language-summary-card__body">
        <div className="files-language-summary-card__grid">
          <div className="files-language-summary-card__main">
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
          </div>
          <div className="files-language-summary-card__stats" aria-label="파일 요약">
            <span className="files-language-summary-card__stats-primary">{totalFiles}개 파일</span>
            <span className="files-language-summary-card__stats-secondary">{formatFileSize(totalSize)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
