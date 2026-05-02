import "./OverviewHeader.css";
import React from "react";
import { PageHeader } from "@/common/ui/primitives";

interface IdentityStat {
  label: string;
  value: string;
  tone?: "neutral" | "info" | "warn" | "critical" | "ok";
}

interface OverviewHeaderProps {
  name: string;
  description?: string | null;
  stats?: IdentityStat[];
}

function toneClass(tone?: IdentityStat["tone"]): string {
  switch (tone) {
    case "info": return "overview-identity__stat--info";
    case "warn": return "overview-identity__stat--warn";
    case "critical": return "overview-identity__stat--critical";
    case "ok": return "overview-identity__stat--ok";
    default: return "";
  }
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({ name, description, stats }) => (
  <div className="overview-identity">
    <div className="overview-identity__heading">
      <PageHeader surface="plain" title={name} />
      {description ? (
        <p className="overview-identity__description">
          <span className="overview-identity__description-mark" aria-hidden="true">//</span>
          <span className="overview-identity__description-body">{description}</span>
        </p>
      ) : null}
    </div>
    {stats && stats.length > 0 ? (
      <dl className="overview-identity__strip" aria-label="프로젝트 지표">
        {stats.map((stat) => (
          <div key={stat.label} className={`overview-identity__stat ${toneClass(stat.tone)}`.trim()}>
            <dt className="overview-identity__label">{stat.label}</dt>
            <dd className="overview-identity__value">{stat.value}</dd>
          </div>
        ))}
      </dl>
    ) : null}
  </div>
);
