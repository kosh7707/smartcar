import React from "react";
import { Separator } from "@/components/ui/separator";

interface OverviewSectionHeaderProps {
  title: string;
}

export const OverviewSectionHeader: React.FC<OverviewSectionHeaderProps> = ({ title }) => (
  <div className="overview-section-header">
    <h2 className="overview-section-header__title">{title}</h2>
    <Separator className="overview-section-header__separator" />
  </div>
);
