import "./FileDetailVulnerabilitiesSection.css";
import React from "react";
import type { Vulnerability } from "@aegis/shared";
import { Shield } from "lucide-react";
import { EmptyState, ListItem, SeverityBadge } from "@/common/ui/primitives";

interface FileDetailVulnerabilitiesSectionProps {
  vulnerabilities: Vulnerability[];
  onSelect: (vulnerability: Vulnerability) => void;
}

export const FileDetailVulnerabilitiesSection: React.FC<
  FileDetailVulnerabilitiesSectionProps
> = ({ vulnerabilities, onSelect }) => (
  <section>
    <div className="panel file-detail-vulns-card">
      <div className="panel-body file-detail-vulns-card__body">
        <div className="file-detail-vulns-card__head">
          <Shield size={16} />
          발견된 취약점 ({vulnerabilities.length})
        </div>
        {vulnerabilities.length === 0 ? (
          <div className="file-detail-vulns-card__empty">
            <EmptyState title="이 파일에서 발견된 취약점이 없습니다" />
          </div>
        ) : (
          <div className="file-detail-vulns-card__list">
            {vulnerabilities.map((vulnerability) => (
              <ListItem
                key={vulnerability.id}
                onClick={() => onSelect(vulnerability)}
                trailing={
                  <span className="file-detail-vulns-card__source">
                    {vulnerability.source === "rule" ? "룰" : "LLM"}
                  </span>
                }
              >
                <div className="file-detail-vulns-card__item">
                  <SeverityBadge severity={vulnerability.severity} />
                  <span className="file-detail-vulns-card__title">
                    {vulnerability.title}
                  </span>
                  <span className="file-detail-vulns-card__location">
                    {vulnerability.location}
                  </span>
                </div>
              </ListItem>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>
);
