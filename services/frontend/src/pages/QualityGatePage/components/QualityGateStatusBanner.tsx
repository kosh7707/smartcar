import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";
import { STATUS_CONFIG } from "../qualityGatePresentation";

export function QualityGateStatusBanner({ gate }: { gate: GateResult }) {
  const verdict =
    gate.status === "pass" ? "통과" : gate.status === "fail" ? "차단" : "경고";
  const config = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.warning;

  return (
    <Card
      className={cn(
        "overflow-hidden border-l-4 shadow-none",
        config.bannerClassName,
        config.accentClassName,
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="space-y-2">
          <Badge
            variant="outline"
            className={cn(
              "min-h-8 rounded-full px-3 text-sm font-semibold",
              config.badgeClassName,
            )}
          >
            {verdict}
          </Badge>
          <div className="text-lg font-semibold tracking-tight">품질 게이트</div>
          <p className="text-sm text-muted-foreground">
            최근 평가: {formatDateTime(gate.evaluatedAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
