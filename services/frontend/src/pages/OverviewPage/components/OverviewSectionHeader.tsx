import React from "react";
import { Separator } from "@/components/ui/separator";

interface OverviewSectionHeaderProps {
  title: string;
}

export const OverviewSectionHeader: React.FC<OverviewSectionHeaderProps> = ({ title }) => (
  <div className="flex items-center gap-4">
    <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">{title}</h2>
    <Separator className="flex-1" />
  </div>
);
