import React from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "../../../shared/ui";

export function StaticAnalysisEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="page-shell static-analysis-empty-state">
      <PageHeader title="정적 분석" />
      <Card className="static-analysis-empty-state__card">
        <CardContent className="static-analysis-empty-state__body">
          <div className="static-analysis-empty-state__copy">
            <p className="static-analysis-empty-state__eyebrow">정적 분석 작업면</p>
            <h2 className="static-analysis-empty-state__title">
              아직 분석 데이터가 없습니다
            </h2>
            <p className="static-analysis-empty-state__description">
              소스 업로드와 빌드 타겟 구성이 끝나면 최근 실행 결과, 주요 취약점, 파일 단위 분석 상태가 이 작업면에 정리됩니다.
            </p>
          </div>

          <div className="static-analysis-empty-state__checklist">
            {["소스 업로드", "빌드 타겟 선택", "정적 분석 실행"].map((item) => (
              <Badge
                key={item}
                variant="outline"
                className="static-analysis-empty-state__check"
              >
                <CheckCircle2 size={14} className="static-analysis-empty-state__check-icon" />
                {item}
              </Badge>
            ))}
          </div>

          <div className="static-analysis-empty-state__actions">
            <Button onClick={onUpload}>
              <Upload size={14} />
              소스 코드 업로드
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
