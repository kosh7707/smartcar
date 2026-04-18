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
  <section>
    <Card className="border-border/70 shadow-none">
      <CardContent className="space-y-3 py-0">
        <div className="flex items-center gap-2 border-b border-border/60 py-4 text-sm font-semibold text-foreground">
          <Shield size={16} />
          발견된 취약점 ({vulnerabilities.length})
        </div>
        {vulnerabilities.length === 0 ? (
          <div className="pb-4">
            <EmptyState title="이 파일에서 발견된 취약점이 없습니다" />
          </div>
        ) : (
          <div className="pb-2">
            {vulnerabilities.map((vulnerability) => (
              <ListItem
                key={vulnerability.id}
                onClick={() => onSelect(vulnerability)}
                trailing={
                  <span className="font-mono text-xs text-muted-foreground">
                    {vulnerability.source === "rule" ? "룰" : "LLM"}
                  </span>
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={vulnerability.severity} size="sm" />
                  <span className="font-medium text-foreground">
                    {vulnerability.title}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
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
