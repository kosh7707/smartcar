import React from "react";
import { EmptyState } from "../../../shared/ui";

export function StaticAnalysisEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="page-enter">
      <div className="sa-page-header"><h1 className="sa-page-header__title">Static Analysis</h1></div>
      <EmptyState
        title="아직 분석 데이터가 없습니다"
        description="소스 코드를 업로드하고 정적 분석을 시작하세요"
        action={
          <button className="btn" onClick={onUpload}>
            소스 코드 업로드
          </button>
        }
      />
    </div>
  );
}
