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
    <Card className="border-border/80 shadow-none">
      <CardHeader className="border-b border-border/70">
        <CardTitle>모듈별 분석 현황</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 text-xs text-muted-foreground">모듈</TableHead>
              <TableHead className="text-center text-xs text-muted-foreground">탐지 항목</TableHead>
              <TableHead className="text-center text-xs text-muted-foreground">게이트 통과</TableHead>
              <TableHead className="px-4 text-right text-xs text-muted-foreground">상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moduleEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  해당 모듈 데이터 없음
                </TableCell>
              </TableRow>
            ) : (
              moduleEntries.map(({ key, mod }) => {
                const hasFailedGate = mod.runs.some((run) => run.gate?.status === "fail");

                return (
                  <TableRow key={key}>
                    <TableCell className="px-4 py-3 whitespace-normal">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {MODULE_META[MODULE_KEY_MAP[key]]?.label ?? key}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{MODULE_KEY_MAP[key]}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold">{mod.summary.totalFindings}</TableCell>
                    <TableCell className="text-center">
                      {mod.runs.filter((run) => run.gate?.status === "pass").length}/{mod.runs.length}
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <Badge
                        variant="outline"
                        className={hasFailedGate
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}
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
