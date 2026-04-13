import React from "react";
import { PageHeader } from "../../../shared/ui";

interface OverviewHeaderProps {
  name: string;
  description?: string | null;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({ name, description }) => (
  <PageHeader
    surface="plain"
    eyebrow="프로젝트 개요"
    title={name}
    subtitle={description ?? undefined}
  />
);
