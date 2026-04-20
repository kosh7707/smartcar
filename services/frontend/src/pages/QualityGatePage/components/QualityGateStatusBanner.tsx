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
      className={cn(config.bannerClassName, config.accentClassName)}
    >
      <CardContent className="quality-gate-status-banner__body">
        <div className="quality-gate-status-banner__copy">
          <Badge
            variant="outline"
            className={cn(config.badgeClassName)}
          >
            {verdict}
          </Badge>
          <div className="quality-gate-status-banner__title">품질 게이트</div>
          <p className="quality-gate-status-banner__timestamp">
            최근 평가: {formatDateTime(gate.evaluatedAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
