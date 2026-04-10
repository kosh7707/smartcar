import React from "react";
import { AlertTriangle } from "lucide-react";

export const DangerZoneSection: React.FC = () => (
  <div className="card project-settings-danger">
    <div className="project-settings-danger__header">
      <AlertTriangle size={16} className="project-settings-danger__icon" />
      <div className="card-title project-settings-danger__title">Danger Zone</div>
    </div>

    <div className="project-settings-danger__body">
      <div className="project-settings-danger__copy">
        <div className="project-settings-danger__label">Delete this project</div>
        <p className="project-settings-danger__description">
          Once deleted, all historical data, scan results, and configuration will be permanently removed. This action cannot be undone.
        </p>
      </div>
      <button className="btn project-settings-danger__button">Delete Project</button>
    </div>
  </div>
);
