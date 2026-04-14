import React from "react";
import { BackButton } from "../../../shared/ui";
import { SourceUploadView } from "./SourceUploadView";

type StaticAnalysisUploadScreenProps = {
  projectId: string;
  onBack: () => void;
  onAnalysisStart: () => void;
  onBrowseTree: () => void;
  onDiscoverTargets: () => void;
};

export function StaticAnalysisUploadScreen({
  projectId,
  onBack,
  onAnalysisStart,
  onBrowseTree,
  onDiscoverTargets,
}: StaticAnalysisUploadScreenProps) {
  return (
    <div className="page-enter">
      <BackButton onClick={onBack} label="대시보드로" />
      <div className="sa-page-header"><h1 className="sa-page-header__title">소스코드 업로드</h1></div>
      <SourceUploadView
        projectId={projectId}
        onAnalysisStart={onAnalysisStart}
        onBrowseTree={onBrowseTree}
        onDiscoverTargets={onDiscoverTargets}
      />
    </div>
  );
}
