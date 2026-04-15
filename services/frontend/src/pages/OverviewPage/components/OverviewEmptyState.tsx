import React from "react";
import { CheckCircle2, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OverviewEmptyStateProps {
  onOpenFiles: () => void;
  onOpenSettings: () => void;
}

export const OverviewEmptyState: React.FC<OverviewEmptyStateProps> = ({ onOpenFiles, onOpenSettings }) => (
  <section className="overview-empty-hero">
    <div className="overview-empty-hero__copy">
      <p className="overview-empty-hero__eyebrow">Workspace status</p>
      <h2 className="overview-empty-hero__title">분석 준비 완료</h2>
      <p className="overview-empty-hero__description">
        소스 업로드와 프로젝트 구성을 마치면 보안 상태, 품질 게이트, 승인 흐름이 이 작업 공간에 순서대로 활성화됩니다.
      </p>
    </div>

    <div className="overview-empty-hero__readiness" aria-label="준비 체크리스트">
      <span><CheckCircle2 size={14} /> 소스 업로드</span>
      <span><CheckCircle2 size={14} /> BuildTarget 확인</span>
      <span><CheckCircle2 size={14} /> 정적 분석 시작</span>
    </div>

    <div className="overview-empty-hero__actions">
      <Button onClick={onOpenFiles}>
        <FileText size={14} /> 파일 업로드
      </Button>
      <Button variant="outline" onClick={onOpenSettings}>
        <Settings size={14} /> 프로젝트 설정
      </Button>
    </div>
  </section>
);
