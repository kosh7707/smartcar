import React from "react";
import { FileText, Settings, Shield } from "lucide-react";
import { EmptyState } from "../../../shared/ui";

interface OverviewEmptyStateProps {
  onOpenFiles: () => void;
  onOpenSettings: () => void;
}

export const OverviewEmptyState: React.FC<OverviewEmptyStateProps> = ({ onOpenFiles, onOpenSettings }) => (
  <EmptyState
    icon={<Shield size={32} />}
    title="분석 준비 완료"
    description="소스 파일을 업로드하고 정적 분석을 실행하면 보안 대시보드가 활성화됩니다."
    action={(
      <div className="overview-empty-hero__actions">
      <button className="btn" onClick={onOpenFiles}>
        <FileText size={14} /> 파일 업로드
      </button>
      <button className="btn btn-secondary" onClick={onOpenSettings}>
        <Settings size={14} /> 프로젝트 설정
      </button>
      </div>
    )}
  />
);
