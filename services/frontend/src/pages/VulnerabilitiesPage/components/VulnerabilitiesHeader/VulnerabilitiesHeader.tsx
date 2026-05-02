import "./VulnerabilitiesHeader.css";
import React from "react";
import type { Severity } from "@aegis/shared";
import { PageHeader } from "@/common/ui/primitives";
import { SEVERITY_KO_LABELS } from "../../vulnerabilitiesPresentation";

interface Counts {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

interface VulnerabilitiesHeaderProps {
  totalActiveFindings: number;
  counts: Counts;
}

const SEGMENTS: Array<{ key: Severity; label: string }> = [
  { key: "critical", label: SEVERITY_KO_LABELS.critical },
  { key: "high",     label: SEVERITY_KO_LABELS.high },
  { key: "medium",   label: SEVERITY_KO_LABELS.medium },
  { key: "low",      label: SEVERITY_KO_LABELS.low },
  { key: "info",     label: SEVERITY_KO_LABELS.info },
];

export const VulnerabilitiesHeader: React.FC<VulnerabilitiesHeaderProps> = ({
  totalActiveFindings,
  counts,
}) => {
  const distributionTotal =
    counts.critical + counts.high + counts.medium + counts.low + counts.info;
  const segments = SEGMENTS.filter((segment) => counts[segment.key] > 0);
  const hasAny = distributionTotal > 0;

  const subtitle = (
    <span className="vuln-page__sub" aria-label="활성 탐지 항목 요약">
      활성 탐지 항목 <span className="num">{totalActiveFindings}</span>건
    </span>
  );

  return (
    <>
      <PageHeader title="취약점 목록" subtitle={subtitle} />

      <section className="vuln-dist" aria-label="심각도 분포">
        <div className="vuln-dist__label">
          <span>§ Severity Distribution</span>
          <span className="vuln-dist__total">n = {distributionTotal}</span>
        </div>
        <div
          className="vuln-dist__bar"
          role="img"
          aria-label={`심각도 분포: 치명 ${counts.critical}, 높음 ${counts.high}, 보통 ${counts.medium}, 낮음 ${counts.low}, 정보 ${counts.info}`}
        >
          {hasAny ? (
            segments.map((segment, index) => {
              const value = counts[segment.key];
              const width = (value / distributionTotal) * 100;
              return (
                <div
                  key={segment.key}
                  className={`vuln-dist__segment vuln-dist__segment--${segment.key}`}
                  style={{ flexBasis: `${width}%`, animationDelay: `${80 + index * 60}ms` }}
                >
                  <span className="vuln-dist__segment-count">{value}</span>
                  <span className="vuln-dist__segment-label">{segment.label}</span>
                </div>
              );
            })
          ) : (
            <div className="vuln-dist__segment vuln-dist__segment--empty">no findings</div>
          )}
        </div>
      </section>
    </>
  );
};
