import React from "react";
import { BackButton, PageHeader } from "../../../shared/ui";
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
    <div className="page-shell static-analysis-upload-screen">
      <BackButton onClick={onBack} label="대시보드로" />
      <PageHeader title="소스코드 업로드" />
      <SourceUploadView
        projectId={projectId}
        onAnalysisStart={onAnalysisStart}
        onBrowseTree={onBrowseTree}
        onDiscoverTargets={onDiscoverTargets}
      />
    </div>
  );
}
