import React from "react";
import type { Vulnerability } from "@aegis/shared";
import { FileText, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface FileDetailSourcePanelProps {
  fileName: string;
  fileLanguage?: string;
  sourceCode: string;
  sourceLines: string[];
  highlightedSourceLines: string[];
  fileVulns: Vulnerability[];
  highlightLine: number;
  highlightRef: React.RefObject<HTMLDivElement | null>;
  viewTab: "code" | "preview";
  onViewTabChange: (value: "code" | "preview") => void;
  maximized: boolean;
  onToggleMaximized: () => void;
  renderedPreview: React.ReactNode;
}

const highlightedRowStyle = {
  background: "color-mix(in srgb, var(--aegis-severity-critical) 10%, transparent)",
  borderLeft: "3px solid var(--aegis-severity-critical)",
} as const;

export const FileDetailSourcePanel: React.FC<FileDetailSourcePanelProps> = ({
  fileName,
  fileLanguage,
  sourceCode,
  sourceLines,
  highlightedSourceLines,
  fileVulns,
  highlightLine,
  highlightRef,
  viewTab,
  onViewTabChange,
  maximized,
  onToggleMaximized,
  renderedPreview,
}) => {
  const isMarkdown =
    fileName.endsWith(".md") ||
    fileLanguage === "markdown" ||
    fileLanguage === "md";

  const codeContent = (
    <ScrollArea
      className={cn(
        "rounded-lg border border-[var(--cds-code-border)] bg-[var(--cds-code-bg)]",
        maximized ? "h-full" : "max-h-[625px]",
      )}
    >
      <div className="min-w-max py-3 font-mono text-sm leading-[1.7] text-[var(--cds-code-text)]">
        {sourceLines.map((line, index) => {
          const lineNum = index + 1;
          const hasVulnerability = fileVulns.some((vulnerability) => {
            const match = vulnerability.location?.match(/:(\d+)/);
            return match && Number.parseInt(match[1], 10) === lineNum;
          });
          const isTarget = lineNum === highlightLine;
          const isHighlighted = hasVulnerability || isTarget;

          return (
            <div
              key={`${lineNum}-${line}`}
              ref={isTarget ? highlightRef : undefined}
              className={cn(
                "flex items-center gap-5 px-5 py-px",
                !isHighlighted && "hover:bg-muted/70",
              )}
              style={isHighlighted ? highlightedRowStyle : undefined}
            >
              <span className="w-10 shrink-0 text-right text-[color:var(--cds-code-line-num)] select-none">
                {lineNum}
              </span>
              <span
                className="flex-1 whitespace-pre"
                dangerouslySetInnerHTML={{
                  __html: highlightedSourceLines[index] ?? line,
                }}
              />
              {isHighlighted && (
                <span className="shrink-0 whitespace-nowrap font-sans text-sm font-medium text-[var(--aegis-severity-critical)]">
                  ← 취약점
                </span>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );

  const previewContent = (
    <ScrollArea
      className={cn(
        "rounded-lg border border-border/70 bg-background",
        maximized ? "h-full" : "max-h-[625px]",
      )}
    >
      <div className="file-detail-markdown px-4 py-3 text-sm leading-7">
        {renderedPreview}
      </div>
    </ScrollArea>
  );

  const maximizeButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      title={maximized ? "축소" : "전체 화면"}
      aria-label={maximized ? "축소" : "전체 화면"}
      onClick={onToggleMaximized}
      className="shrink-0"
    >
      {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </Button>
  );

  const nonMarkdownBody = (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="text-sm font-semibold text-foreground">소스 코드</div>
        {maximizeButton}
      </div>
      <div className="space-y-4 px-4 py-4">
        {codeContent}
        {sourceCode.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            <FileText size={20} />
            <span>표시할 소스 코드가 없습니다</span>
          </div>
        )}
      </div>
    </>
  );

  const markdownBody = (
    <Tabs
      value={viewTab}
      onValueChange={(value) => onViewTabChange(value as "code" | "preview")}
      className="gap-0"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <TabsList variant="line" className="h-auto rounded-none p-0">
          <TabsTrigger value="code" className="px-3 py-1.5 text-sm">
            코드
          </TabsTrigger>
          <TabsTrigger value="preview" className="px-3 py-1.5 text-sm">
            프리뷰
          </TabsTrigger>
        </TabsList>
        {maximizeButton}
      </div>
      <div className="px-4 py-4">
        <TabsContent value="code" className="mt-0">
          {codeContent}
        </TabsContent>
        <TabsContent value="preview" className="mt-0">
          {previewContent}
        </TabsContent>
      </div>
    </Tabs>
  );

  const panelBody = isMarkdown ? markdownBody : nonMarkdownBody;

  if (maximized) {
    return (
      <Dialog open={maximized} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onToggleMaximized();
        }
      }}>
        <DialogContent
          showCloseButton={false}
          className="h-[calc(100dvh-3rem)] max-w-6xl overflow-hidden border-border/70 p-0 sm:max-w-6xl"
          overlayClassName="bg-black/30 supports-backdrop-filter:backdrop-blur-xs"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{fileName} 전체 화면 보기</DialogTitle>
            <DialogDescription>
              파일 소스 코드와 마크다운 프리뷰를 전체 화면으로 확인합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex h-full flex-col overflow-hidden">
            <Card className="h-full rounded-none border-0 shadow-none">
              <CardContent className="flex h-full flex-col px-0 py-0">
                <div className="min-h-0 flex-1">
                  {panelBody}
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="px-0 py-0">
        {panelBody}
      </CardContent>
    </Card>
  );
};
