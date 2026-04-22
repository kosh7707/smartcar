import React from "react";
import { EmptyState } from "../../../shared/ui";

interface PlaceholderSettingsSectionProps {
  title: string;
  description: string;
}

export const PlaceholderSettingsSection: React.FC<
  PlaceholderSettingsSectionProps
> = ({ title, description }) => (
  <div className="panel project-settings-card project-settings-placeholder">
    <div className="panel-body">
      <EmptyState title={title} description={description} />
    </div>
  </div>
);
