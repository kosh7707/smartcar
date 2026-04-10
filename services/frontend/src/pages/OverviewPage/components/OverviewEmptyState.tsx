import React from "react";
import { FileText, Settings, Shield } from "lucide-react";

interface OverviewEmptyStateProps {
  onOpenFiles: () => void;
  onOpenSettings: () => void;
}

export const OverviewEmptyState: React.FC<OverviewEmptyStateProps> = ({ onOpenFiles, onOpenSettings }) => (
  <div className="card overview-empty-hero">
    <div className="overview-empty-hero__icon">
      <Shield size={48} />
    </div>
    <h2 className="overview-empty-hero__title">분석 준비 완료</h2>
    <p className="overview-empty-hero__desc">
      소스 파일을 업로드하고 정적 분석을 실행하면 보안 대시보드가 활성화됩니다.
    </p>
    <div className="overview-empty-hero__actions">
      <button className="btn" onClick={onOpenFiles}>
        <FileText size={14} /> 파일 업로드
      </button>
      <button className="btn btn-secondary" onClick={onOpenSettings}>
        <Settings size={14} /> 프로젝트 설정
      </button>
    </div>
  </div>
);
