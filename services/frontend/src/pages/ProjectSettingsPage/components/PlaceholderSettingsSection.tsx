import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "../../../shared/ui";

interface PlaceholderSettingsSectionProps {
  title: string;
  description: string;
}

export const PlaceholderSettingsSection: React.FC<
  PlaceholderSettingsSectionProps
> = ({ title, description }) => (
  <Card className="project-settings-card project-settings-placeholder">
    <CardContent>
      <EmptyState title={title} description={description} />
    </CardContent>
  </Card>
);
