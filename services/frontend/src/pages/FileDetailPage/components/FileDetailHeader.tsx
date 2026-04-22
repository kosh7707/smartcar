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
import { cn } from "@/lib/utils";
import { formatFileSize } from "../../../utils/format";
import { getLangColorByName } from "../../../constants/languages";

const FileDetailIcon: React.FC<{ language?: string }> = ({ language }) => {
  const size = 28;
  const lang = language?.toLowerCase() ?? "";
  const color = getLangColorByName(lang) || "var(--cds-text-placeholder)";

  if (["c", "cpp", "cc", "cxx", "h", "hpp", "hh", "hxx", "java", "python", "py", "javascript", "js", "typescript", "ts"].includes(lang)) {
    return <FileCode size={size} className="file-detail-header__icon-svg" style={{ color }} />;
  }
  if (["shell", "sh", "bash", "powershell"].includes(lang)) {
    return <Terminal size={size} className="file-detail-header__icon-svg" style={{ color }} />;
  }
  if (["cmake", "make"].includes(lang)) {
    return <Wrench size={size} className="file-detail-header__icon-svg" style={{ color: "#064f8c" }} />;
  }
  if (["json", "yaml", "yml", "toml", "xml", "config"].includes(lang)) {
    return <Settings size={size} className="file-detail-header__icon-svg" style={{ color: "var(--cds-text-placeholder)" }} />;
  }
  if (["markdown", "md", "text", "txt"].includes(lang)) {
    return <BookOpen size={size} className="file-detail-header__icon-svg" style={{ color: "var(--cds-text-placeholder)" }} />;
  }
  if (["linker-script"].includes(lang)) {
    return <Link2 size={size} className="file-detail-header__icon-svg" style={{ color: "var(--cds-text-placeholder)" }} />;
  }
  return <FileText size={size} className="file-detail-header__icon-svg" style={{ color }} />;
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
    <div className="panel file-detail-header-card">
      <div className="panel-head file-detail-header-card__head">
        <div className="file-detail-header-card__top">
          <div className="file-detail-header-card__identity">
            <div className="file-detail-header-card__icon-shell">
              <FileDetailIcon language={file.language} />
            </div>
            <div className="file-detail-header-card__title-wrap">
              <h3 className="panel-title file-detail-header-card__title">{file.name}</h3>
              {file.path && file.path !== file.name ? (
                <p className="file-detail-header-card__path">{file.path}</p>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onDownload} className="btn btn-outline btn-sm file-detail-header-card__download">
            <Download size={14} /> 다운로드
          </button>
        </div>
      </div>
      <div className="panel-body file-detail-header-card__badges">
        {file.language ? (
          <span
            className="file-detail-header-card__badge"
            style={{ borderColor: languageColor }}
          >
            <span className="file-detail-header-card__badge-dot" style={{ background: languageColor }} />
            {file.language}
          </span>
        ) : null}
        {file.size > 0 ? (
          <span className="file-detail-header-card__badge">
            {formatFileSize(file.size)}
          </span>
        ) : null}
        <span className="file-detail-header-card__badge">
          {lineCount}줄
        </span>
        {vulnerabilityCount > 0 ? (
          <span
            className={cn(
              "file-detail-header-card__badge",
              "file-detail-header-card__badge--vulnerability",
            )}
          >
            <Shield size={12} />
            취약점 {vulnerabilityCount}건
          </span>
        ) : null}
      </div>
    </div>
  );
};
