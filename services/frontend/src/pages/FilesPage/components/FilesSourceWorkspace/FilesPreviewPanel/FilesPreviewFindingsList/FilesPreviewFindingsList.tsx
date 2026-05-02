import "./FilesPreviewFindingsList.css";
import React from "react";
import type { Finding } from "@aegis/shared";
import { parseLocation } from "@/common/utils/location";

interface FilesPreviewFindingsListProps {
  findings: Finding[];
  onSelect: (findingId: string) => void;
}

export const FilesPreviewFindingsList: React.FC<FilesPreviewFindingsListProps> = ({ findings, onSelect }) => (
  <div className="files-workspace-findings">
    <div className="files-workspace-findings-title">
      탐지 항목 ({findings.length})
    </div>
    <div className="files-workspace-findings-list">
      {findings.map((finding) => {
        const { line } = parseLocation(finding.location);
        return (
          <button
            key={finding.id}
            type="button"
            className="files-workspace-finding-row"
            onClick={() => onSelect(finding.id)}
          >
            <span className="files-workspace-finding-title">{finding.title}</span>
            {line ? <span className="files-workspace-finding-line">:{line}</span> : null}
          </button>
        );
      })}
    </div>
  </div>
);
