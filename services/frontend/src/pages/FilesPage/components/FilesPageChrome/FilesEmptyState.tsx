import React from "react";
import { EmptyState } from "../../../shared/ui";

export function FilesEmptyState() {
  return (
    <EmptyState
      className="empty-state--workspace"
      title="아직 업로드된 소스코드가 없습니다"
      description="소스코드 아카이브(.zip, .tar.gz)를 드래그하거나 업로드 버튼을 사용하세요"
    />
  );
}
