import React from "react";
import { PageHeader } from "../../../shared/ui";

interface VulnerabilitiesHeaderProps {
  totalActiveFindings: number;
}

export const VulnerabilitiesHeader: React.FC<VulnerabilitiesHeaderProps> = ({ totalActiveFindings }) => (
  <PageHeader
    surface="plain"
    eyebrow="취약점 검토"
    title="Vulnerabilities"
    subtitle="현재 프로젝트에서 triage가 필요한 finding을 검토합니다."
    action={(
      <div className="vuln-page-header__meta">
        <span className="vuln-page-header__count">
          Total active findings: <strong>{totalActiveFindings}</strong>
        </span>
      </div>
    )}
  />
);
