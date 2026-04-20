import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";
import { STATUS_CONFIG } from "../qualityGatePresentation";

export function QualityGateSidebar({ gates }: { gates: GateResult[] }) {
  return (
    <div className="quality-gate-sidebar">
      <Card className="quality-gate-sidebar__history">
        <CardHeader>
          <CardTitle>최근 게이트 판정</CardTitle>
          <CardDescription>최신 8회 평가를 시간순으로 빠르게 검토할 수 있습니다.</CardDescription>
        </CardHeader>

        <CardContent className="quality-gate-sidebar__history-body">
          <ScrollArea className="quality-gate-sidebar__history-scroll">
            <div className="quality-gate-sidebar__history-list">
              {gates.slice(0, 8).map((gate, index) => {
                const config = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.warning;
                const historyLabel = gate.status === "pass" ? "통과" : gate.status === "fail" ? "차단" : "경고";

                return (
                  <div key={gate.id} className={cn("quality-gate-sidebar__history-row", index === 0 && "is-latest")}>
                    <span className="quality-gate-sidebar__history-index">#{index + 1}</span>
                    <span className="quality-gate-sidebar__history-time">{formatDateTime(gate.evaluatedAt)}</span>
                    <Badge variant="outline" className={config.badgeClassName}>{historyLabel}</Badge>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="quality-gate-sidebar__guide">
        <CardHeader>
          <CardTitle>조치 안내</CardTitle>
          <CardDescription>오버라이드는 승인된 프로젝트 리드만 실행할 수 있습니다.</CardDescription>
        </CardHeader>

        <CardContent>
          <p className="quality-gate-sidebar__guide-copy">
            실패 규칙을 무시해야 하는 경우에는 사유를 10자 이상으로 남기고,
            사후 검토를 위해 승인자를 지정해 두어야 합니다.
          </p>
          <Separator />
          <Button variant="outline" size="sm" className="quality-gate-sidebar__guide-action" disabled>
            오버라이드 요청
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
