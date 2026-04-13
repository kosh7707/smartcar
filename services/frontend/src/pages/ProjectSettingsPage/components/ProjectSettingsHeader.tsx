import React from "react";
import { PageHeader } from "../../../shared/ui";

export const ProjectSettingsHeader: React.FC = () => (
  <PageHeader
    surface="plain"
    eyebrow="프로젝트 설정"
    title="프로젝트 설정"
    subtitle="SDK, 빌드, 알림과 프로젝트 메타데이터를 관리합니다."
  />
);
