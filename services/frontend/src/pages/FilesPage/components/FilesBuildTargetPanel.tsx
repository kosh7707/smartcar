import React from "react";
import { HardDrive, Plus, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import { TargetStatusBadge } from "../../../shared/ui";

export function FilesBuildTargetPanel({
  targets,
  onOpenLog,
  onOpenCreateTarget,
}: {
  targets: ReturnType<typeof useBuildTargets>["targets"];
  onOpenLog: (target: { id: string; name: string }) => void;
  onOpenCreateTarget: () => void;
}) {
  return (
    <Card className="files-build-target-panel">
      <CardHeader className="files-build-target-panel__head">
        <CardTitle className="files-build-target-panel__title">
          <HardDrive size={16} />
          빌드 타겟 현황
          {targets.length > 0 && (
            <span className="files-build-target-panel__title-count">({targets.length}개)</span>
          )}
        </CardTitle>
        <Button size="sm" onClick={onOpenCreateTarget}>
          <Plus size={14} />
          빌드 타겟 생성
        </Button>
      </CardHeader>
      <CardContent className="files-build-target-panel__body">
        {targets.length === 0 ? (
          <div className="files-build-target-panel__empty">
            아직 생성된 빌드 타겟이 없습니다.
          </div>
        ) : (
          targets.map((target) => (
            <div key={target.id} className="files-build-target-panel__row">
              <span className="files-build-target-panel__name">{target.name}</span>
              <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
              <span className="files-build-target-panel__path">{target.relativePath}</span>
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
          ))
        )}
      </CardContent>
    </Card>
  );
}
