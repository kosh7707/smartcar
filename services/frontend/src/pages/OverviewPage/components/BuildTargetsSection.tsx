import React from "react";
import type { BuildTarget } from "@aegis/shared";
import { HardDrive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TargetStatusBadge } from "../../../shared/ui";
import { OverviewSectionHeader } from "./OverviewSectionHeader";

interface BuildTargetsSectionProps {
  targets: BuildTarget[];
  onOpenFiles: () => void;
}

export const BuildTargetsSection: React.FC<BuildTargetsSectionProps> = ({ targets, onOpenFiles }) => {
  if (targets.length === 0) return null;

  return (
    <section className="space-y-5">
      <OverviewSectionHeader title="빌드 타겟" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {targets.map((target) => (
          <Card
            key={target.id}
            className="cursor-pointer gap-4 border-border/70 bg-card/80 p-5 shadow-none transition-colors hover:bg-muted/40"
            onClick={onOpenFiles}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <HardDrive size={18} />
                </div>
                <div className="space-y-1">
                  <span className="block text-base font-semibold tracking-tight text-foreground">{target.name}</span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    업로드된 소스와 연결된 빌드 입력을 정리하고 분석 흐름을 준비합니다.
                  </p>
                </div>
              </div>
              <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
            </div>

            <div className="flex items-end justify-between border-t border-border/60 pt-4">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Findings
                </span>
                <span className="font-mono text-3xl font-semibold leading-none tracking-tight text-foreground">—</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">소스 보기</span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
