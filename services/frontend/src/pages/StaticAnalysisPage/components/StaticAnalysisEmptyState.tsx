import React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "../../../shared/ui";

export function StaticAnalysisEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="page-shell static-analysis-empty-state">
      <PageHeader title="정적 분석" />
      <Card className="static-analysis-empty-state__card">
        <CardContent className="static-analysis-empty-state__body">
          <span className="static-analysis-empty-state__eyebrow">AWAITING INPUT</span>
          <h2 className="static-analysis-empty-state__title">분석 대기</h2>
          <p className="static-analysis-empty-state__description">
            소스 아카이브 업로드 → 빌드 타겟 선택 → 정적 분석 실행 순으로 진행됩니다. 완료된 실행 결과, 주요 취약점, 파일 단위 상태가 이 화면에 누적됩니다.
          </p>

          <div className="static-analysis-empty-state__actions">
            <Button size="lg" onClick={onUpload}>
              <Upload size={14} />
              소스 코드 업로드
            </Button>
          </div>

          <p className="static-analysis-empty-state__formats">
            <span className="static-analysis-empty-state__formats-label">지원 아카이브</span>
            <code>.zip</code>
            <code>.tar.gz</code>
            <code>.tgz</code>
            <code>.tar.bz2</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
