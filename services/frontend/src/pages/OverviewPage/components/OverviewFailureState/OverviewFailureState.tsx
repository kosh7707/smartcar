import "./OverviewFailureState.css";
import React from "react";
import { PageHeader } from "@/common/ui/primitives";

export function OverviewFailureState() {
  return (
    <div className="page-enter">
      <PageHeader
        surface="plain"
        title="데이터를 불러올 수 없습니다"
        subtitle="프로젝트 상태와 최근 흐름을 불러오는 중 문제가 발생했습니다."
      />
    </div>
  );
}
