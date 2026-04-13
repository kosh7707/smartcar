import React from "react";
import { PageHeader } from "../../../shared/ui";

interface OverviewHeaderProps {
  name: string;
  description?: string | null;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({ name, description }) => (
  <PageHeader
    surface="plain"
    title={name}
    subtitle={description ?? undefined}
  />
);
