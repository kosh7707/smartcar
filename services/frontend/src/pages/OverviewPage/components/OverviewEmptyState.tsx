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
    <Card className="overview-empty-state">
      <div className="overview-empty-state__copy">
        <Badge variant="outline" className="overview-empty-state__badge">
          Workspace status
        </Badge>
        <div className="overview-empty-state__text">
          <h2 className="overview-empty-state__title">분석 준비 완료</h2>
          <p className="overview-empty-state__description">
            소스 업로드와 프로젝트 구성을 마치면 보안 상태, 품질 게이트, 승인 흐름이 이 작업 공간에 순서대로 활성화됩니다.
          </p>
        </div>
      </div>

      <div className="overview-empty-state__checklist" aria-label="준비 체크리스트">
        {readinessItems.map((item) => (
          <Badge
            key={item}
            variant="secondary"
            className="overview-empty-state__check"
          >
            <CheckCircle2 size={14} className="overview-empty-state__check-icon" />
            {item}
          </Badge>
        ))}
      </div>

      <div className="overview-empty-state__actions">
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
