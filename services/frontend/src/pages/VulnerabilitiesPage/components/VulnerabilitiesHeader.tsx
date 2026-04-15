import React from "react";
import { PageHeader } from "../../../shared/ui";

interface VulnerabilitiesHeaderProps {
  totalActiveFindings: number;
}

export const VulnerabilitiesHeader: React.FC<VulnerabilitiesHeaderProps> = ({ totalActiveFindings }) => (
  <PageHeader
    surface="plain"
    title="취약점 목록"
    subtitle="현재 프로젝트에서 우선 검토가 필요한 탐지 항목을 분류하고 조치합니다."
    action={(
      <div className="vuln-page-header__meta">
        <span className="vuln-page-header__count">
          활성 탐지 항목: <strong>{totalActiveFindings}</strong>
        </span>
      </div>
    )}
  />
);
