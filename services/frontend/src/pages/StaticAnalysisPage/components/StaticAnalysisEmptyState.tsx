import React from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "../../../shared/ui";

export function StaticAnalysisEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="page-enter space-y-6">
      <PageHeader title="정적 분석" />
      <Card className="w-full max-w-[58rem] border-border/70 shadow-none">
        <CardContent className="space-y-5 p-7">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.08em] text-muted-foreground">정적 분석 작업면</p>
            <h2 className="text-[clamp(1.5rem,1.2rem+0.8vw,2rem)] font-semibold tracking-[-0.03em] text-foreground">
              아직 분석 데이터가 없습니다
            </h2>
            <p className="max-w-[38rem] text-sm leading-7 text-muted-foreground">
              소스 업로드와 빌드 타겟 구성이 끝나면 최근 실행 결과, 주요 취약점, 파일 단위 분석 상태가 이 작업면에 정리됩니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {["소스 업로드", "빌드 타겟 선택", "정적 분석 실행"].map((item) => (
              <Badge
                key={item}
                variant="outline"
                className="h-auto min-h-8 rounded-full bg-background/80 px-4 py-1 text-sm font-medium text-muted-foreground"
              >
                <CheckCircle2 size={14} />
                {item}
              </Badge>
            ))}
          </div>

          <div>
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
