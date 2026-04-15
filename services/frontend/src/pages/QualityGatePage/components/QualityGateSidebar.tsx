import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";

export function QualityGateSidebar({ gates }: { gates: GateResult[] }) {
  return (
    <div className="gate-side-col">
      <Card className="gate-history-card shadow-none">
        <CardContent className="space-y-3">
          <CardTitle className="gate-history-card__title">
            최근 게이트 판정
          </CardTitle>
          <div className="gate-history-list">
            {gates.slice(0, 8).map((gate, index) => (
              <div
                key={gate.id}
                className={`gate-history-row${index === 0 ? " gate-history-row--active" : ""}`}
              >
                <span className="gate-history-row__run">#{index + 1}</span>
                <span className="gate-history-row__time">
                  {formatDateTime(gate.evaluatedAt)}
                </span>
                <span
                  className={`gate-history-row__status gate-history-row__status--${gate.status === "pass" ? "pass" : gate.status === "fail" ? "fail" : "warning"}`}
                >
                  {gate.status === "pass"
                    ? "통과"
                    : gate.status === "fail"
                      ? "차단"
                      : "경고"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="gate-actions-card shadow-none">
        <CardContent className="space-y-3">
          <CardTitle className="gate-actions-card__title">조치 안내</CardTitle>
          <p className="gate-actions-card__desc">
            오버라이드는 승인된 프로젝트 리드만 실행할 수 있습니다.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gate-actions-card__btn"
            disabled
          >
            오버라이드 요청
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
