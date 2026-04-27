import React from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, Plug, Target } from "lucide-react";

type PlaceholderKind = "build-targets" | "adapters" | "notifications";

interface PlaceholderSettingsSectionProps {
  kind: PlaceholderKind;
  panelLabel: string;
  title: string;
  description: string;
  paneId: string;
}

const ICON_FOR: Record<PlaceholderKind, LucideIcon> = {
  "build-targets": Target,
  "adapters": Plug,
  "notifications": Bell,
};

const TARGETS_PREVIEW = [
  { key: "$",  text: "aegis build-target list" },
  { key: "→", text: "release-gateway   (ti-am335x, -O2, -fstack-protector)" },
  { key: "→", text: "debug-gateway     (ti-am335x, -Og, -g3)" },
  { key: "→", text: "secure-fw         (nxp-imx8,  -O2, -D_FORTIFY_SOURCE=2)" },
];

export const PlaceholderSettingsSection: React.FC<PlaceholderSettingsSectionProps> = ({
  kind,
  panelLabel,
  title,
  description,
  paneId,
}) => {
  const Icon = ICON_FOR[kind];
  const showPreview = kind === "build-targets";

  return (
    <section className="ps-section" data-pane={paneId} role="tabpanel" aria-label={panelLabel}>
      <div className="ps-section-head">
        <div>
          <h2 className="ps-section-head__title">{panelLabel}</h2>
          <p className="ps-section-head__desc">{description}</p>
        </div>
      </div>

      <div className="ps-reserved">
        <div className="ps-reserved__icon" aria-hidden="true">
          <Icon size={20} />
        </div>
        <div className="ps-reserved__head">
          <h4 className="ps-reserved__title">
            <span>{title}</span>
            <span className="ps-ver-tag">v0.2</span>
          </h4>
        </div>
        {showPreview ? (
          <pre className="ps-reserved__preview" aria-hidden="true">
            {TARGETS_PREVIEW.map((line, idx) => (
              <span key={idx} className="ps-reserved__preview-line">
                <span className="ps-reserved__preview-key">{line.key}</span>
                <span>{line.text}</span>
              </span>
            ))}
          </pre>
        ) : null}
      </div>
    </section>
  );
};
