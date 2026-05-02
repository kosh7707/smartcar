import "./FilesBinaryPreview.css";
import React from "react";
import { Binary, FileArchive, FileImage, FileMusic, FileText, FileType, FileVideo } from "lucide-react";
import type { FileClass } from "@/common/utils/fileClass";
import { FILE_CLASS_LABEL } from "@/common/utils/fileClass";
import { formatFileSize } from "@/common/utils/format";

interface FilesBinaryPreviewProps {
  path: string;
  size: number;
  language?: string | null;
  fileClass: Exclude<FileClass, "text">;
}

const ICON_BY_CLASS: Record<FilesBinaryPreviewProps["fileClass"], React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  archive: FileArchive,
  executable: Binary,
  image: FileImage,
  media: FileMusic,
  document: FileText,
  font: FileType,
  "unknown-binary": Binary,
};

const ICON_BY_EXT: Partial<Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>> = {
  mp4: FileVideo,
  mov: FileVideo,
  mkv: FileVideo,
  avi: FileVideo,
  webm: FileVideo,
  m4v: FileVideo,
};

function pickIcon(path: string, fileClass: FilesBinaryPreviewProps["fileClass"]) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ICON_BY_EXT[ext] ?? ICON_BY_CLASS[fileClass];
}

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export const FilesBinaryPreview: React.FC<FilesBinaryPreviewProps> = ({ path, size, language, fileClass }) => {
  const Icon = pickIcon(path, fileClass);
  const typeLabel = FILE_CLASS_LABEL[fileClass];
  const ext = path.split(".").pop()?.toLowerCase() ?? "";

  const rows: Array<{ label: string; value: string }> = [
    { label: "PATH", value: path },
    { label: "NAME", value: fileName(path) },
    { label: "SIZE", value: formatFileSize(size) },
    { label: "TYPE", value: typeLabel },
  ];
  if (ext) rows.push({ label: "EXTENSION", value: `.${ext}` });
  if (language) rows.push({ label: "LANGUAGE", value: language });

  return (
    <div className="files-workspace-binary-preview">
      <header className="files-workspace-binary-preview__eyebrow">
        <span className="files-workspace-binary-preview__dot" aria-hidden="true" />
        <span>PREVIEW · {typeLabel.toUpperCase()}</span>
      </header>

      <div className="files-workspace-binary-preview__anchor" aria-hidden="true">
        <Icon size={34} strokeWidth={1.5} />
      </div>

      <div className="files-workspace-binary-preview__copy">
        <strong className="files-workspace-binary-preview__title">이 형식은 텍스트 미리보기를 제공하지 않습니다</strong>
        <div className="files-workspace-binary-preview__text">{typeLabel} 파일은 원본을 직접 열어야 내용을 확인할 수 있습니다.</div>
      </div>

      <dl className="files-workspace-binary-preview__meta">
        {rows.map((row) => (
          <div key={row.label} className="files-workspace-binary-preview__meta-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
