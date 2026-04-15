import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

export const DangerZoneSection: React.FC = () => (
  <Card className="project-settings-danger shadow-none">
    <CardContent className="space-y-4">
      <div className="project-settings-danger__header">
        <AlertTriangle size={16} className="project-settings-danger__icon" />
        <CardTitle className="project-settings-danger__title">
          Danger Zone
        </CardTitle>
      </div>

      <div className="project-settings-danger__body">
        <div className="project-settings-danger__copy">
          <div className="project-settings-danger__label">
            Delete this project
          </div>
          <p className="project-settings-danger__description">
            Once deleted, all historical data, scan results, and configuration
            will be permanently removed. This action cannot be undone.
          </p>
        </div>
        <Button
          variant="destructive"
          className="project-settings-danger__button"
        >
          Delete Project
        </Button>
      </div>
    </CardContent>
  </Card>
);
