import React from "react";
import type { UploadedFile } from "@aegis/shared";
import {
  BookOpen,
  Download,
  FileCode,
  FileText,
  Link2,
  Settings,
  Shield,
  Terminal,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize } from "../../../utils/format";
import { getLangColorByName } from "../../../constants/languages";

const FileDetailIcon: React.FC<{ language?: string }> = ({ language }) => {
  const size = 28;
  const lang = language?.toLowerCase() ?? "";
  const color = getLangColorByName(lang) || "var(--cds-text-placeholder)";
  if (
    [
      "c",
      "cpp",
      "cc",
      "cxx",
      "h",
      "hpp",
      "hh",
      "hxx",
      "java",
      "python",
      "py",
      "javascript",
      "js",
      "typescript",
      "ts",
    ].includes(lang)
  ) {
    return <FileCode size={size} style={{ color, flexShrink: 0 }} />;
  }
  if (["shell", "sh", "bash", "powershell"].includes(lang)) {
    return <Terminal size={size} style={{ color, flexShrink: 0 }} />;
  }
  if (["cmake", "make"].includes(lang)) {
    return <Wrench size={size} style={{ color: "#064f8c", flexShrink: 0 }} />;
  }
  if (["json", "yaml", "yml", "toml", "xml", "config"].includes(lang)) {
    return (
      <Settings
        size={size}
        style={{ color: "var(--cds-text-placeholder)", flexShrink: 0 }}
      />
    );
  }
  if (["markdown", "md", "text", "txt"].includes(lang)) {
    return (
      <BookOpen
        size={size}
        style={{ color: "var(--cds-text-placeholder)", flexShrink: 0 }}
      />
    );
  }
  if (["linker-script"].includes(lang)) {
    return (
      <Link2
        size={size}
        style={{ color: "var(--cds-text-placeholder)", flexShrink: 0 }}
      />
    );
  }
  return <FileText size={size} style={{ color, flexShrink: 0 }} />;
};

interface FileDetailHeaderProps {
  file: UploadedFile;
  lineCount: number;
  vulnerabilityCount: number;
  onDownload: () => void;
}

export const FileDetailHeader: React.FC<FileDetailHeaderProps> = ({
  file,
  lineCount,
  vulnerabilityCount,
  onDownload,
}) => {
  const languageColor = file.language ? getLangColorByName(file.language) : undefined;

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
              <FileDetailIcon language={file.language} />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="truncate font-mono text-lg tracking-tight text-foreground">
                {file.name}
              </CardTitle>
              {file.path && file.path !== file.name && (
                <p className="truncate font-mono text-sm text-muted-foreground">
                  {file.path}
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onDownload} className="shrink-0 self-start">
            <Download size={14} /> 다운로드
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-4">
        {file.language && (
          <Badge
            variant="outline"
            className="h-8 rounded-full px-3 text-sm font-medium"
            style={{ borderColor: languageColor }}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: languageColor }}
            />
            {file.language}
          </Badge>
        )}
        {file.size > 0 && (
          <Badge variant="outline" className="h-8 rounded-full px-3 text-sm font-medium">
            {formatFileSize(file.size)}
          </Badge>
        )}
        <Badge variant="outline" className="h-8 rounded-full px-3 text-sm font-medium">
          {lineCount}줄
        </Badge>
        {vulnerabilityCount > 0 && (
          <Badge
            variant="outline"
            className="h-8 rounded-full border-[var(--aegis-severity-high-border)] bg-[var(--aegis-severity-high-bg)] px-3 text-sm font-medium text-[var(--aegis-severity-high)]"
          >
            <Shield size={12} />
            취약점 {vulnerabilityCount}건
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
