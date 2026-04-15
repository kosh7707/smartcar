import React from "react";
import { HardDrive, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import { TargetStatusBadge } from "../../../shared/ui";

export function FilesBuildTargetPanel({
  targets,
  onOpenLog,
}: {
  targets: ReturnType<typeof useBuildTargets>["targets"];
  onOpenLog: (target: { id: string; name: string }) => void;
}) {
  if (targets.length === 0) return null;

  return (
    <div className="fpage-build-target-card">
      <div className="fpage-build-target-card__title flex-center flex-gap-2">
        <HardDrive size={16} />
        빌드 타겟 현황 ({targets.length}개)
      </div>
      <div className="fpage-build-target-list">
        {targets.map((target) => (
          <div key={target.id} className="fpage-build-target-row">
            <span className="fpage-build-target-name">{target.name}</span>
            <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
            <span className="fpage-build-target-meta">{target.relativePath}</span>
            {target.status && target.status !== "discovered" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenLog({ id: target.id, name: target.name })}
                title="빌드 로그"
              >
                <ScrollText size={14} />
                빌드 로그
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
