import React from "react";
import type { Vulnerability } from "@aegis/shared";
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ListItem, SeverityBadge } from "../../../shared/ui";

interface FileDetailVulnerabilitiesSectionProps {
  vulnerabilities: Vulnerability[];
  onSelect: (vulnerability: Vulnerability) => void;
}

export const FileDetailVulnerabilitiesSection: React.FC<
  FileDetailVulnerabilitiesSectionProps
> = ({ vulnerabilities, onSelect }) => (
  <section className="file-detail-section-card">
    <Card className="shadow-none">
      <CardContent className="space-y-3">
        <div className="file-detail-section-title">
          <Shield size={16} />
          발견된 취약점 ({vulnerabilities.length})
        </div>
        {vulnerabilities.length === 0 ? (
          <EmptyState title="이 파일에서 발견된 취약점이 없습니다" />
        ) : (
          <div>
            {vulnerabilities.map((vulnerability) => (
              <ListItem
                key={vulnerability.id}
                onClick={() => onSelect(vulnerability)}
                trailing={
                  <span className="file-detail-vuln-source">
                    {vulnerability.source === "rule" ? "룰" : "LLM"}
                  </span>
                }
              >
                <div className="file-detail-vuln-row">
                  <SeverityBadge severity={vulnerability.severity} size="sm" />
                  <span className="file-detail-vuln-title">
                    {vulnerability.title}
                  </span>
                  <span className="file-detail-vuln-location">
                    {vulnerability.location}
                  </span>
                </div>
              </ListItem>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  </section>
);
