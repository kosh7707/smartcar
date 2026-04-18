import React from "react";
import type { BuildTarget, UploadedFile, Vulnerability } from "@aegis/shared";
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  HardDrive,
  Loader,
  Search,
  Shield,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SeverityBadge, TargetStatusBadge } from "../../../shared/ui";
import { formatFileSize } from "../../../utils/format";

interface OverviewBottomGridProps {
  projectFiles: UploadedFile[];
  totalFileSize: number;
  topVulnerabilities: Vulnerability[];
  totalVulnerabilities: number;
  targets: BuildTarget[];
  targetSummary?: {
    ready: number;
    running: number;
    failed: number;
    discovered: number;
  } | null;
  onOpenFiles: () => void;
  onOpenFileDetail: (fileId: string) => void;
  onOpenVulnerabilities: () => void;
}

export const OverviewBottomGrid: React.FC<OverviewBottomGridProps> = ({
  projectFiles,
  totalFileSize,
  topVulnerabilities,
  totalVulnerabilities,
  targets,
  targetSummary,
  onOpenFiles,
  onOpenFileDetail,
  onOpenVulnerabilities,
}) => (
  <section className="grid gap-4 xl:grid-cols-3">
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileText size={16} />
            파일 ({projectFiles.length})
            {projectFiles.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">· {formatFileSize(totalFileSize)}</span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onOpenFiles}>
            보기 <ChevronRight size={16} />
          </Button>
        </div>

        {projectFiles.length === 0 ? (
          <p className="inline-flex min-h-9 items-center rounded-lg border border-border/70 bg-background/80 px-4 text-sm font-medium text-muted-foreground">
            아직 업로드된 파일이 없습니다.
          </p>
        ) : (
          <>
            <ScrollArea className="max-h-64 pr-2">
              <div className="space-y-1">
                {projectFiles.slice(0, 8).map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    onClick={() => onOpenFileDetail(file.id)}
                  >
                    <FileText size={14} className="shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{file.name}</div>
                      {file.path && file.path !== file.name && (
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {file.path.slice(0, file.path.lastIndexOf("/"))}/
                        </div>
                      )}
                    </div>
                    {file.language && (
                      <Badge variant="outline" className="shrink-0">
                        {file.language}
                      </Badge>
                    )}
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
            {projectFiles.length >= 5 && (
              <Button variant="ghost" size="sm" className="w-full justify-center" onClick={onOpenFiles}>
                전체 보기 <ChevronRight size={16} />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>

    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Shield size={16} /> 주요 취약점
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onOpenVulnerabilities}>
            보기 <ChevronRight size={16} />
          </Button>
        </div>

        {topVulnerabilities.length === 0 ? (
          <p className="inline-flex min-h-9 items-center rounded-lg border border-border/70 bg-background/80 px-4 text-sm font-medium text-muted-foreground">
            발견된 취약점이 없습니다.
          </p>
        ) : (
          <>
            <ScrollArea className="max-h-64 pr-2">
              <div className="space-y-2">
                {topVulnerabilities.map((vulnerability) => (
                  <button
                    key={vulnerability.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    onClick={onOpenVulnerabilities}
                  >
                    <SeverityBadge severity={vulnerability.severity} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{vulnerability.title}</div>
                      {vulnerability.location && (
                        <div className="truncate font-mono text-xs text-muted-foreground">{vulnerability.location}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
            {totalVulnerabilities >= 5 && (
              <Button variant="ghost" size="sm" className="w-full justify-center" onClick={onOpenVulnerabilities}>
                전체 보기 <ChevronRight size={16} />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>

    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <HardDrive size={16} /> 빌드 타겟 ({targets.length}개)
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onOpenFiles}>
            보기 <ChevronRight size={16} />
          </Button>
        </div>

        {targetSummary && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={12} /> 준비 {targetSummary.ready}
            </Badge>
            <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <Loader size={12} /> 진행 {targetSummary.running}
            </Badge>
            <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
              <XCircle size={12} /> 실패 {targetSummary.failed}
            </Badge>
            <Badge variant="outline" className="border-border/80 bg-background/80 text-muted-foreground">
              <Search size={12} /> 감지 {targetSummary.discovered}
            </Badge>
          </div>
        )}

        {targets.length === 0 ? (
          <p className="inline-flex min-h-9 items-center rounded-lg border border-border/70 bg-background/80 px-4 text-sm font-medium text-muted-foreground">
            등록된 빌드 타겟이 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {targets.map((target) => (
              <div key={target.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                <span className="truncate text-sm font-medium text-foreground">{target.name}</span>
                <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  </section>
);
