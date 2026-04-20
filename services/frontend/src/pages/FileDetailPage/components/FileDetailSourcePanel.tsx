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
        "file-detail-source-code-scroll",
        maximized && "is-maximized",
      )}
    >
      <div className="file-detail-source-code">
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
                "file-detail-source-line",
                isHighlighted
                  ? "file-detail-source-line--highlighted"
                  : "file-detail-source-line--hoverable",
              )}
            >
              <span className="file-detail-source-line-num">{lineNum}</span>
              <span
                className="file-detail-source-line-text"
                dangerouslySetInnerHTML={{
                  __html: highlightedSourceLines[index] ?? line,
                }}
              />
              {isHighlighted ? (
                <span className="file-detail-source-line-flag">← 취약점</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );

  const previewContent = (
    <ScrollArea
      className={cn(
        "file-detail-source-preview-scroll",
        maximized && "is-maximized",
      )}
    >
      <div className="file-detail-markdown file-detail-source-preview-body">
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
      className="file-detail-source-maximize"
    >
      {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </Button>
  );

  const nonMarkdownBody = (
    <>
      <div className="file-detail-source-panel-head">
        <div className="file-detail-source-panel-title">소스 코드</div>
        {maximizeButton}
      </div>
      <div className="file-detail-source-panel-body">
        {codeContent}
        {sourceCode.length === 0 ? (
          <div className="file-detail-source-empty">
            <FileText size={20} />
            <span>표시할 소스 코드가 없습니다</span>
          </div>
        ) : null}
      </div>
    </>
  );

  const markdownBody = (
    <Tabs
      value={viewTab}
      onValueChange={(value) => onViewTabChange(value as "code" | "preview")}
      className="file-detail-source-tabs"
    >
      <div className="file-detail-source-panel-head">
        <TabsList variant="line" className="file-detail-source-tabs-list">
          <TabsTrigger value="code" className="file-detail-source-tabs-trigger">
            코드
          </TabsTrigger>
          <TabsTrigger value="preview" className="file-detail-source-tabs-trigger">
            프리뷰
          </TabsTrigger>
        </TabsList>
        {maximizeButton}
      </div>
      <div className="file-detail-source-panel-body">
        <TabsContent value="code" className="file-detail-source-tabs-content">
          {codeContent}
        </TabsContent>
        <TabsContent value="preview" className="file-detail-source-tabs-content">
          {previewContent}
        </TabsContent>
      </div>
    </Tabs>
  );

  const panelBody = isMarkdown ? markdownBody : nonMarkdownBody;

  if (maximized) {
    return (
      <Dialog
        open={maximized}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onToggleMaximized();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="file-detail-source-dialog"
          overlayClassName="file-detail-source-overlay"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{fileName} 전체 화면 보기</DialogTitle>
            <DialogDescription>
              파일 소스 코드와 마크다운 프리뷰를 전체 화면으로 확인합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="file-detail-source-dialog-shell">
            <Card className="file-detail-source-dialog-card">
              <CardContent className="file-detail-source-dialog-card-body">
                <div className="file-detail-source-dialog-content">{panelBody}</div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="file-detail-source-card">
      <CardContent className="file-detail-source-card-body">{panelBody}</CardContent>
    </Card>
  );
};
