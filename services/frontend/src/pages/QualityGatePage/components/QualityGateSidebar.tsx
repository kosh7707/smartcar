import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";
import { STATUS_CONFIG } from "../qualityGatePresentation";

export function QualityGateSidebar({ gates }: { gates: GateResult[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card className="overflow-hidden shadow-none">
        <CardHeader className="border-b border-border bg-muted/40 p-5">
          <CardTitle>최근 게이트 판정</CardTitle>
          <CardDescription>
            최신 8회 평가를 시간순으로 빠르게 검토할 수 있습니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-border">
              {gates.slice(0, 8).map((gate, index) => {
                const config = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.warning;
                const historyLabel =
                  gate.status === "pass"
                    ? "통과"
                    : gate.status === "fail"
                      ? "차단"
                      : "경고";

                return (
                  <div
                    key={gate.id}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3 text-sm",
                      index === 0 && "bg-muted/50",
                    )}
                  >
                    <span className="min-w-8 font-mono font-semibold text-primary">
                      #{index + 1}
                    </span>
                    <span className="min-w-0 flex-1 font-mono text-xs text-muted-foreground sm:text-sm">
                      {formatDateTime(gate.evaluatedAt)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium sm:text-sm",
                        config.badgeClassName,
                      )}
                    >
                      {historyLabel}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="border-b border-border bg-gradient-to-b from-muted/70 to-background/95 p-5">
          <CardTitle>조치 안내</CardTitle>
          <CardDescription>
            오버라이드는 승인된 프로젝트 리드만 실행할 수 있습니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            실패 규칙을 무시해야 하는 경우에는 사유를 10자 이상으로 남기고,
            사후 검토를 위해 승인자를 지정해 두어야 합니다.
          </p>
          <Separator />
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center"
            disabled
          >
            오버라이드 요청
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
