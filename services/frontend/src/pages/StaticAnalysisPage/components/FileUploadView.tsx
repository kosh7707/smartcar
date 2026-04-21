import React, { useCallback } from "react";
import { Upload, FileText, Check } from "lucide-react";
import type { UploadedFile } from "@aegis/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { PageHeader } from "../../../shared/ui";

interface LocalFile {
  file: File;
  name: string;
  size: number;
  info: { id: string; name: string; size: number; language?: string };
}
import { formatFileSize } from "../../../utils/format";

interface Props {
  existingFiles: UploadedFile[];
  selectedExisting: UploadedFile[];
  onToggleExisting: (file: UploadedFile) => void;
  onSelectAll?: () => void;
  files: LocalFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onStartAnalysis: () => void;
}

export const FileUploadView: React.FC<Props> = ({
  existingFiles,
  selectedExisting,
  onToggleExisting,
  onSelectAll,
  files,
  onAddFiles,
  onRemoveFile,
  onStartAnalysis,
}) => {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onAddFiles(Array.from(e.dataTransfer.files));
    },
    [onAddFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        onAddFiles(Array.from(e.target.files));
      }
    },
    [onAddFiles]
  );

  const totalSelected = selectedExisting.length + files.length;

  return (
    <div className="page-shell static-upload-view">
      <PageHeader surface="plain" title="소스 코드 업로드" />

      {existingFiles.length > 0 && (
        <Card className="static-upload-view__existing-card">
          <CardContent className="static-upload-view__existing-body">
          <CardTitle className="static-upload-view__section-title">
            <FileText size={16} />
            프로젝트 파일에서 선택 ({selectedExisting.length}/{existingFiles.length})
            {onSelectAll && selectedExisting.length < existingFiles.length && (
              <Button variant="outline" size="sm" className="static-upload-view__select-all" onClick={onSelectAll}>
                전체 선택
              </Button>
            )}
          </CardTitle>
          {existingFiles.map((file) => {
            const selected = selectedExisting.some((f) => f.id === file.id);
            return (
              <div
                key={file.id}
                className={`static-upload-view__existing-row${selected ? " static-upload-view__existing-row--selected" : ""}`}
                onClick={() => onToggleExisting(file)}
              >
                <div className={`static-upload-view__existing-check${selected ? " static-upload-view__existing-check--active" : ""}`}>
                  {selected && <Check size={12} />}
                </div>
                <span className="static-upload-view__file-name">{file.name}</span>
                {file.language && <span className="static-upload-view__file-lang">{file.language}</span>}
                <span className="static-upload-view__file-size">{formatFileSize(file.size)}</span>
              </div>
            );
          })}
          </CardContent>
        </Card>
      )}

      <Card
        className="static-upload-view__dropzone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <CardContent>
        <div className="static-upload-view__dropzone-body">
          <div className="static-upload-view__dropzone-icon">
            <Upload size={36} />
          </div>
          <p className="static-upload-view__dropzone-title">새 파일을 드래그하거나 클릭하여 업로드</p>
          <small className="static-upload-view__dropzone-copy">지원 형식: .c .cpp .h .hpp .py .java .js .ts</small>
        </div>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".c,.cpp,.h,.hpp,.py,.java,.js,.ts"
          className="static-upload-view__hidden-input"
          onChange={handleFileSelect}
        />
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card className="static-upload-view__added-card">
          <CardContent className="static-upload-view__added-body">
          <CardTitle>새로 추가한 파일 ({files.length})</CardTitle>
          {files.map((f, i) => (
            <div key={f.info.id} className="static-upload-view__added-row">
              <div className="static-upload-view__added-info">
                <span className="static-upload-view__file-name">{f.info.name}</span>
                <span className="static-upload-view__file-lang">
                  {f.info.language === "python" ? "Python" : "C/C++"}
                </span>
              </div>
              <div className="static-upload-view__added-actions">
                <span className="static-upload-view__file-size">
                  {(f.info.size / 1024).toFixed(1)}KB
                </span>
                <Button variant="outline" size="sm" onClick={() => onRemoveFile(i)}>
                  삭제
                </Button>
              </div>
            </div>
          ))}
          </CardContent>
        </Card>
      )}

      {totalSelected > 0 && (
        <div className="static-upload-view__footer">
          <span className="static-upload-view__summary">
            총 {totalSelected}개 파일 선택됨
            {selectedExisting.length > 0 && files.length > 0 && (
              <> (기존 {selectedExisting.length} + 새 파일 {files.length})</>
            )}
          </span>
          <Button onClick={onStartAnalysis}>
            분석 시작
          </Button>
        </div>
      )}
    </div>
  );
};
