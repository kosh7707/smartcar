import React from "react";
import { EmptyState } from "../../../shared/ui";

interface PlaceholderSettingsSectionProps {
  title: string;
  description: string;
}

export const PlaceholderSettingsSection: React.FC<PlaceholderSettingsSectionProps> = ({ title, description }) => (
  <div className="card project-settings-card project-settings-placeholder">
    <EmptyState title={title} description={description} />
  </div>
);
