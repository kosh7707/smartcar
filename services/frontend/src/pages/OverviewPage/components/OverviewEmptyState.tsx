import React from "react";
import { CheckCircle2, FileText, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface OverviewEmptyStateProps {
  onOpenFiles: () => void;
  onOpenSettings: () => void;
}

const readinessItems = ["소스 업로드", "BuildTarget 확인", "정적 분석 시작"];

export const OverviewEmptyState: React.FC<OverviewEmptyStateProps> = ({ onOpenFiles, onOpenSettings }) => (
  <section>
    <Card className="gap-6 border-border/70 bg-linear-to-br from-background via-background to-muted/40 p-6 shadow-none sm:p-8">
      <div className="space-y-4">
        <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Workspace status
        </Badge>
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">분석 준비 완료</h2>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            소스 업로드와 프로젝트 구성을 마치면 보안 상태, 품질 게이트, 승인 흐름이 이 작업 공간에 순서대로 활성화됩니다.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="준비 체크리스트">
        {readinessItems.map((item) => (
          <Badge
            key={item}
            variant="secondary"
            className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-sm font-medium text-muted-foreground"
          >
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            {item}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onOpenFiles}>
          <FileText size={14} /> 파일 업로드
        </Button>
        <Button variant="outline" onClick={onOpenSettings}>
          <Settings size={14} /> 프로젝트 설정
        </Button>
      </div>
    </Card>
  </section>
);
