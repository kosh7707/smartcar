import React from "react";

interface PlaceholderSettingsSectionProps {
  panelLabel: string;
  title: string;
  description: string;
}

export const PlaceholderSettingsSection: React.FC<PlaceholderSettingsSectionProps> = ({
  panelLabel,
  title,
  description,
}) => (
  <section className="panel" role="tabpanel" aria-label={panelLabel}>
    <div className="panel-head">
      <h3>{panelLabel}</h3>
      <span className="label-caps">reserved</span>
    </div>
    <div className="panel-body ps-reserved">
      <p className="ps-reserved__title">{title}</p>
      <p className="ps-reserved__desc">{description}</p>
    </div>
  </section>
);
