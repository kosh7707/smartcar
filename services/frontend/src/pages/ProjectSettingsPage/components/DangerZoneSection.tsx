import React from "react";
import { AlertTriangle } from "lucide-react";

interface DangerZoneSectionProps {
  onRequestDelete: () => void;
  deleting: boolean;
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({ onRequestDelete, deleting }) => (
  <section className="panel ps-danger" role="tabpanel" aria-label="위험 구역">
    <div className="panel-head">
      <h3>
        <AlertTriangle size={14} aria-hidden="true" />
        위험 구역
      </h3>
      <span className="sev-chip critical" aria-hidden="true">
        <span className="sev-dot" />
        irreversible
      </span>
    </div>
    <div className="panel-body ps-danger__row">
      <div className="ps-danger__copy">
        <h4 className="ps-danger__title">프로젝트 삭제</h4>
        <p className="ps-danger__desc">
          삭제된 프로젝트는 분석 이력, 스캔 결과, 등록된 SDK 및 구성을 포함해 영구적으로 제거됩니다.
          이 작업은 되돌릴 수 없습니다.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        onClick={onRequestDelete}
        disabled={deleting}
      >
        {deleting ? "삭제 중..." : "프로젝트 삭제"}
      </button>
    </div>
  </section>
);
