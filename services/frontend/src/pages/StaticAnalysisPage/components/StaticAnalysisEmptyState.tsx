import React from "react";
import { CheckCircle2, Upload } from "lucide-react";

export function StaticAnalysisEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="page-enter">
      <div className="sa-page-header"><h1 className="sa-page-header__title">정적 분석</h1></div>
      <section className="sa-empty-state">
        <div className="sa-empty-state__copy">
          <p className="sa-empty-state__eyebrow">정적 분석 작업면</p>
          <h2 className="sa-empty-state__title">아직 분석 데이터가 없습니다</h2>
          <p className="sa-empty-state__description">
            소스 업로드와 빌드 타겟 구성이 끝나면 최근 실행 결과, 주요 취약점, 파일 단위 분석 상태가 이 작업면에 정리됩니다.
          </p>
        </div>

        <div className="sa-empty-state__readiness">
          <span><CheckCircle2 size={14} /> 소스 업로드</span>
          <span><CheckCircle2 size={14} /> 빌드 타겟 선택</span>
          <span><CheckCircle2 size={14} /> 정적 분석 실행</span>
        </div>

        <div className="sa-empty-state__actions">
          <button className="btn" onClick={onUpload}>
            <Upload size={14} />
            소스 코드 업로드
          </button>
        </div>
      </section>
    </div>
  );
}
