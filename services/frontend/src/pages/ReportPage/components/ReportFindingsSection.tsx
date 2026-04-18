import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectReport } from "@aegis/shared";
import { EmptyState, FindingStatusBadge, SeverityBadge, SourceBadge } from "../../../shared/ui";
import { MODULE_META } from "../../../constants/modules";

type FindingsEntry = ProjectReport["modules"][keyof ProjectReport["modules"]] extends infer T
  ? T extends { findings: infer F } ? F extends Array<infer U> ? U : never : never
  : never;

interface ReportFindingsSectionProps {
  findings: FindingsEntry[];
}

export const ReportFindingsSection: React.FC<ReportFindingsSectionProps> = ({ findings }) => (
  <Card className="border-border/80 shadow-none">
    <CardHeader className="border-b border-border/70">
      <CardTitle>탐지 항목 목록 ({findings.length})</CardTitle>
    </CardHeader>
    <CardContent className="px-0">
      {findings.length === 0 ? (
        <div className="px-4 py-6">
          <EmptyState compact title="해당 조건의 탐지 항목이 없습니다" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 text-xs text-muted-foreground">상태</TableHead>
              <TableHead className="text-xs text-muted-foreground">심각도</TableHead>
              <TableHead className="text-xs text-muted-foreground">제목</TableHead>
              <TableHead className="text-xs text-muted-foreground">출처</TableHead>
              <TableHead className="text-xs text-muted-foreground">모듈</TableHead>
              <TableHead className="px-4 text-center text-xs text-muted-foreground">증적</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map(({ finding, evidenceRefs }) => (
              <TableRow key={finding.id}>
                <TableCell className="px-4"><FindingStatusBadge status={finding.status} size="sm" /></TableCell>
                <TableCell><SeverityBadge severity={finding.severity} size="sm" /></TableCell>
                <TableCell className="whitespace-normal">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{finding.title}</p>
                    {finding.location && (
                      <p className="font-mono text-xs text-muted-foreground">{finding.location}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal"><SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} /></TableCell>
                <TableCell>{MODULE_META[finding.module]?.label ?? finding.module}</TableCell>
                <TableCell className="px-4 text-center">
                  {evidenceRefs.length > 0 ? (
                    <Badge variant="outline" className="rounded-md px-2 py-1 text-xs text-muted-foreground">
                      {evidenceRefs.length}건
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);
