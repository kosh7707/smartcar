import React from "react";
import { PageHeader } from "../../../shared/ui";

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
    <PageHeader
      surface="plain"
      title={name}
      subtitle={description ?? undefined}
    />
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
