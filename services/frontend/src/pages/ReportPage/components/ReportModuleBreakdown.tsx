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
import { MODULE_KEY_MAP, type ReportModuleEntry } from "../reportPresentation";
import { MODULE_META } from "../../../constants/modules";

export function ReportModuleBreakdown({ moduleEntries }: { moduleEntries: ReportModuleEntry[] }) {
  return (
    <Card className="report-module-breakdown-card">
      <CardHeader className="report-module-breakdown-card__head">
        <CardTitle>모듈별 분석 현황</CardTitle>
      </CardHeader>
      <CardContent className="report-module-breakdown-card__body">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="report-module-breakdown-card__head-cell report-module-breakdown-card__head-cell--pad">모듈</TableHead>
              <TableHead className="report-module-breakdown-card__head-cell report-module-breakdown-card__head-cell--center">탐지 항목</TableHead>
              <TableHead className="report-module-breakdown-card__head-cell report-module-breakdown-card__head-cell--center">게이트 통과</TableHead>
              <TableHead className="report-module-breakdown-card__head-cell report-module-breakdown-card__head-cell--pad report-module-breakdown-card__head-cell--right">상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moduleEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="report-module-breakdown-card__empty-cell">
                  해당 모듈 데이터 없음
                </TableCell>
              </TableRow>
            ) : (
              moduleEntries.map(({ key, mod }) => {
                const hasFailedGate = mod.runs.some((run) => run.gate?.status === "fail");

                return (
                  <TableRow key={key}>
                    <TableCell className="report-module-breakdown-card__cell report-module-breakdown-card__cell--pad report-module-breakdown-card__cell--wrap">
                      <div className="report-module-breakdown-card__module-copy">
                        <p className="report-module-breakdown-card__module-title">
                          {MODULE_META[MODULE_KEY_MAP[key]]?.label ?? key}
                        </p>
                        <p className="report-module-breakdown-card__module-key">{MODULE_KEY_MAP[key]}</p>
                      </div>
                    </TableCell>
                    <TableCell className="report-module-breakdown-card__cell report-module-breakdown-card__cell--center report-module-breakdown-card__cell--mono">{mod.summary.totalFindings}</TableCell>
                    <TableCell className="report-module-breakdown-card__cell report-module-breakdown-card__cell--center">
                      {mod.runs.filter((run) => run.gate?.status === "pass").length}/{mod.runs.length}
                    </TableCell>
                    <TableCell className="report-module-breakdown-card__cell report-module-breakdown-card__cell--pad report-module-breakdown-card__cell--right">
                      <Badge
                        variant="outline"
                        className={hasFailedGate
                          ? "report-module-breakdown-card__status-badge report-module-breakdown-card__status-badge--warning"
                          : "report-module-breakdown-card__status-badge report-module-breakdown-card__status-badge--stable"}
                      >
                        {hasFailedGate ? "주의 필요" : "안정"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
