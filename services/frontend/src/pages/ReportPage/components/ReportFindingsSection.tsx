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
  <Card className="report-findings-card">
    <CardHeader className="report-findings-card__head">
      <CardTitle>탐지 항목 목록 ({findings.length})</CardTitle>
    </CardHeader>
    <CardContent className="report-findings-card__body">
      {findings.length === 0 ? (
        <div className="report-findings-card__empty">
          <EmptyState compact title="해당 조건의 탐지 항목이 없습니다" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="report-findings-card__head-cell report-findings-card__head-cell--pad">상태</TableHead>
              <TableHead className="report-findings-card__head-cell">심각도</TableHead>
              <TableHead className="report-findings-card__head-cell">제목</TableHead>
              <TableHead className="report-findings-card__head-cell">출처</TableHead>
              <TableHead className="report-findings-card__head-cell">모듈</TableHead>
              <TableHead className="report-findings-card__head-cell report-findings-card__head-cell--center report-findings-card__head-cell--pad">증적</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map(({ finding, evidenceRefs }) => (
              <TableRow key={finding.id}>
                <TableCell className="report-findings-card__cell report-findings-card__cell--pad"><FindingStatusBadge status={finding.status} size="sm" /></TableCell>
                <TableCell><SeverityBadge severity={finding.severity} size="sm" /></TableCell>
                <TableCell className="report-findings-card__cell report-findings-card__cell--wrap">
                  <div className="report-findings-card__title-block">
                    <p className="report-findings-card__title">{finding.title}</p>
                    {finding.location && (
                      <p className="report-findings-card__location">{finding.location}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="report-findings-card__cell report-findings-card__cell--wrap"><SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} /></TableCell>
                <TableCell>{MODULE_META[finding.module]?.label ?? finding.module}</TableCell>
                <TableCell className="report-findings-card__cell report-findings-card__cell--center report-findings-card__cell--pad">
                  {evidenceRefs.length > 0 ? (
                    <Badge variant="outline" className="report-findings-card__evidence-badge">
                      {evidenceRefs.length}건
                    </Badge>
                  ) : (
                    <span className="report-findings-card__evidence-empty">&mdash;</span>
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
