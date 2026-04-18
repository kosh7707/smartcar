import React from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RegisteredSdk } from "../../../api/sdk";
import { formatFileSize } from "../../../utils/format";
import type { GateCounts } from "../overviewModel";
import { getSdkStatusLabel, getSdkStatusToneClass } from "../overviewModel";

interface OverviewMetaPanelProps {
  fileCount: number;
  totalFileSize: number;
  description?: string | null;
  hasFiles: boolean;
  hasGates: boolean;
  gateCounts: GateCounts;
  approvalCount: { pending: number; total: number };
  registeredSdks: RegisteredSdk[];
  onOpenQualityGate: () => void;
  onOpenApprovals: () => void;
  onOpenSettings: () => void;
}

interface MetaCardProps {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}

function MetaCard({ title, onClick, children }: MetaCardProps) {
  return (
    <Card
      className={`gap-4 border-border/70 bg-card/80 p-5 shadow-none ${onClick ? "cursor-pointer transition-colors hover:bg-muted/40" : ""}`}
      onClick={onClick}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      {children}
    </Card>
  );
}

export const OverviewMetaPanel: React.FC<OverviewMetaPanelProps> = ({
  fileCount,
  totalFileSize,
  description,
  hasFiles,
  hasGates,
  gateCounts,
  approvalCount,
  registeredSdks,
  onOpenQualityGate,
  onOpenApprovals,
  onOpenSettings,
}) => (
  <aside className="space-y-4">
    <MetaCard title="프로젝트 메타데이터">
      <dl className="space-y-4 text-sm">
        <div className="space-y-1">
          <dt className="font-medium text-muted-foreground">Files</dt>
          <dd className="font-mono text-foreground">{fileCount}</dd>
        </div>
        {hasFiles && (
          <div className="space-y-1">
            <dt className="font-medium text-muted-foreground">Total Size</dt>
            <dd className="font-mono text-foreground">{formatFileSize(totalFileSize)}</dd>
          </div>
        )}
        {description && (
          <div className="space-y-1">
            <dt className="font-medium text-muted-foreground">Description</dt>
            <dd className="leading-6 text-foreground">{description}</dd>
          </div>
        )}
      </dl>
    </MetaCard>

    {hasGates && (
      <MetaCard title="Quality Gate" onClick={onOpenQualityGate}>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={12} /> 통과 {gateCounts.pass}
          </Badge>
          <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
            <XCircle size={12} /> 실패 {gateCounts.fail}
          </Badge>
          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <AlertTriangle size={12} /> 경고 {gateCounts.warning}
          </Badge>
        </div>
      </MetaCard>
    )}

    <MetaCard title="승인 요청" onClick={onOpenApprovals}>
      <div className="flex items-end justify-between gap-3">
        {approvalCount.pending > 0 ? (
          <div className="flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold leading-none text-red-700 dark:text-red-300">
              {approvalCount.pending}
            </span>
            <span className="pb-0.5 text-sm text-muted-foreground">건 대기 중</span>
          </div>
        ) : (
          <p className="inline-flex min-h-7 items-center rounded-md border border-border/70 bg-background/80 px-3 text-xs font-medium text-muted-foreground">
            대기 없음
          </p>
        )}
        {approvalCount.total > 0 && <span className="text-sm text-muted-foreground">총 {approvalCount.total}건</span>}
      </div>
    </MetaCard>

    {registeredSdks.length > 0 && (
      <MetaCard title={`SDK (${registeredSdks.length}개)`} onClick={onOpenSettings}>
        <div className="space-y-2">
          {registeredSdks.slice(0, 4).map((sdk) => (
            <div key={sdk.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
              <span className="truncate text-sm font-medium text-foreground">{sdk.name}</span>
              <Badge variant="outline" className={getSdkStatusToneClass(sdk.status)}>
                {getSdkStatusLabel(sdk.status)}
              </Badge>
            </div>
          ))}
        </div>
      </MetaCard>
    )}
  </aside>
);
