import React from "react";
import { DashboardEmptySurface } from "./DashboardEmptySurface";

interface DashboardSectionEmptyProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone?: "default" | "attention";
}

export const DashboardSectionEmpty: React.FC<DashboardSectionEmptyProps> = ({
  icon,
  title,
  description,
  tone = "default",
}) => (
  <DashboardEmptySurface
    icon={icon}
    title={title}
    description={description}
    tone={tone}
    variant="panel"
  />
);
