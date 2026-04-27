import React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DangerZoneSectionProps {
  onRequestDelete: () => void;
  deleting: boolean;
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({ onRequestDelete, deleting }) => (
  <section className="ps-section" data-pane="danger" role="tabpanel" aria-label="위험 구역">
    <div className="ps-section-head">
      <div>
        <h2 className="ps-section-head__title">위험 구역</h2>
        <p className="ps-section-head__desc">
          이곳의 작업은 되돌릴 수 없으며, 분석 이력·승인 기록·등록된 SDK를 포함한 모든 프로젝트 데이터에 영향을 미칩니다.
        </p>
      </div>
    </div>

    <div className="ps-danger">
      <div className="ps-danger__head">
        <h3 className="ps-danger__head-title">
          <AlertTriangle size={14} aria-hidden="true" />
          위험 구역
        </h3>
        <span className="ps-danger__tag">irreversible</span>
      </div>

      <div className="ps-danger__row">
        <div className="ps-danger__copy">
          <h4 className="ps-danger__title">프로젝트 아카이브</h4>
          <p className="ps-danger__desc">
            프로젝트를 읽기 전용 상태로 전환합니다. 새 분석은 실행되지 않지만 기존 보고서와 이력은 유지됩니다.
            언제든 복원할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled
          aria-disabled="true"
          title="아카이브 기능은 준비 중입니다"
        >
          프로젝트 아카이브
        </button>
      </div>

      <div className="ps-danger__row">
        <div className="ps-danger__copy">
          <h4 className="ps-danger__title">프로젝트 삭제</h4>
          <p className="ps-danger__desc">
            분석 이력, 스캔 결과, 등록된 SDK 및 구성이 영구적으로 제거됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={onRequestDelete}
          disabled={deleting}
        >
          <Trash2 size={14} />
          {deleting ? "삭제 중..." : "프로젝트 삭제"}
        </button>
      </div>
    </div>
  </section>
);
