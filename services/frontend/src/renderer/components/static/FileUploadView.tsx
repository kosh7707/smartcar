import React, { useCallback } from "react";
import { Upload, FileText, Check } from "lucide-react";
import type { UploadedFile } from "@aegis/shared";

interface LocalFile { file: File; name: string; size: number }
import { formatFileSize } from "../../utils/format";

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
    <div className="page-enter">
      <h2 className="page-title">정적 분석</h2>

      {/* Existing project files */}
      {existingFiles.length > 0 && (
        <div className="card">
          <div className="card-title">
            <FileText size={16} />
            프로젝트 파일에서 선택 ({selectedExisting.length}/{existingFiles.length})
            {onSelectAll && selectedExisting.length < existingFiles.length && (
              <button className="btn btn-secondary btn-sm ml-auto" onClick={onSelectAll}>
                전체 선택
              </button>
            )}
          </div>
          {existingFiles.map((file) => {
            const selected = selectedExisting.some((f) => f.id === file.id);
            return (
              <div
                key={file.id}
                className={`file-select-row${selected ? " file-select-row--selected" : ""}`}
                onClick={() => onToggleExisting(file)}
              >
                <div className={`file-select-check${selected ? " file-select-check--active" : ""}`}>
                  {selected && <Check size={12} />}
                </div>
                <span className="file-name">{file.name}</span>
                {file.language && <span className="file-lang">{file.language}</span>}
                <span className="file-size">{formatFileSize(file.size)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* New file upload */}
      <div
        className="card drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <div className="drop-zone-content">
          <div className="drop-zone-icon">
            <Upload size={36} />
          </div>
          <p>새 파일을 드래그하거나 클릭하여 업로드</p>
          <small>지원 형식: .c .cpp .h .hpp .py .java .js .ts</small>
        </div>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".c,.cpp,.h,.hpp,.py,.java,.js,.ts"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
      </div>

      {files.length > 0 && (
        <div className="card animate-fade-in-up">
          <div className="card-title">새로 추가한 파일 ({files.length})</div>
          {files.map((f, i) => (
            <div key={f.info.id} className="file-row">
              <div className="file-info">
                <span className="file-name">{f.info.name}</span>
                <span className="file-lang">
                  {f.info.language === "python" ? "Python" : "C/C++"}
                </span>
              </div>
              <div className="file-actions">
                <span className="file-size">
                  {(f.info.size / 1024).toFixed(1)}KB
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => onRemoveFile(i)}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalSelected > 0 && (
        <div className="file-upload-footer animate-fade-in">
          <span className="file-upload-summary">
            총 {totalSelected}개 파일 선택됨
            {selectedExisting.length > 0 && files.length > 0 && (
              <> (기존 {selectedExisting.length} + 새 파일 {files.length})</>
            )}
          </span>
          <button className="btn" onClick={onStartAnalysis}>
            분석 시작
          </button>
        </div>
      )}
    </div>
  );
};
