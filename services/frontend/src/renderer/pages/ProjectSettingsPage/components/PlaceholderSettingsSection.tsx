import React from "react";
import { EmptyState } from "../../../components/ui";

interface PlaceholderSettingsSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const PlaceholderSettingsSection: React.FC<PlaceholderSettingsSectionProps> = ({ icon, title, description }) => (
  <div className="card">
    <EmptyState icon={icon} title={title} description={description} />
  </div>
);
