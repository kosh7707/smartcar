import React from "react";
import { PageHeader } from "../../../shared/ui";

export function FileDetailMissingState() {
  return (
    <div className="page-enter">
      <PageHeader
        surface="plain"
        title="파일을 찾을 수 없습니다"
        subtitle="선택한 파일이 삭제되었거나 현재 프로젝트 범위 밖에 있습니다."
      />
    </div>
  );
}
