import React from "react";
import type { UploadedFile } from "@aegis/shared";
import { BookOpen, Download, FileCode, FileText, Link2, Settings, Shield, Terminal, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "../../../utils/format";
import { getLangColorByName } from "../../../constants/languages";

const FileDetailIcon: React.FC<{ language?: string }> = ({ language }) => {
  const size = 28;
  const lang = language?.toLowerCase() ?? "";
  const color = getLangColorByName(lang) || "var(--cds-text-placeholder)";
  if (["c", "cpp", "cc", "cxx", "h", "hpp", "hh", "hxx", "java", "python", "py", "javascript", "js", "typescript", "ts"].includes(lang)) {
    return <FileCode size={size} style={{ color, flexShrink: 0 }} />;
  }
  if (["shell", "sh", "bash", "powershell"].includes(lang)) return <Terminal size={size} style={{ color, flexShrink: 0 }} />;
  if (["cmake", "make"].includes(lang)) return <Wrench size={size} style={{ color: "#064f8c", flexShrink: 0 }} />;
  if (["json", "yaml", "yml", "toml", "xml", "config"].includes(lang)) return <Settings size={size} style={{ color: "var(--cds-text-placeholder)", flexShrink: 0 }} />;
  if (["markdown", "md", "text", "txt"].includes(lang)) return <BookOpen size={size} style={{ color: "var(--cds-text-placeholder)", flexShrink: 0 }} />;
  if (["linker-script"].includes(lang)) return <Link2 size={size} style={{ color: "var(--cds-text-placeholder)", flexShrink: 0 }} />;
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
}) => (
  <section className="card file-detail-header">
    <div className="file-detail-header__top">
      <FileDetailIcon language={file.language} />
      <div className="file-detail-header__info">
        <h2 className="file-detail-header__name">{file.name}</h2>
        {file.path && file.path !== file.name && (
          <span className="file-detail-header__path">{file.path}</span>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onDownload}>
        <Download size={14} /> 다운로드
      </Button>
    </div>
    <div className="file-detail-header__badges">
      {file.language && (
        <span className="file-detail-badge" style={{ borderColor: getLangColorByName(file.language) }}>
          <span className="file-detail-badge__dot" style={{ background: getLangColorByName(file.language) }} />
          {file.language}
        </span>
      )}
      {file.size > 0 && <span className="file-detail-badge">{formatFileSize(file.size)}</span>}
      <span className="file-detail-badge">{lineCount}줄</span>
      {vulnerabilityCount > 0 && (
        <span className="file-detail-badge file-detail-badge--warn">
          <Shield size={12} />
          취약점 {vulnerabilityCount}건
        </span>
      )}
    </div>
  </section>
);
