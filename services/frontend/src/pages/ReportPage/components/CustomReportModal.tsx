import React, { useState } from "react";
import { FileText, X } from "lucide-react";
import { generateCustomReport } from "../../../api/report";
import { logError } from "../../../api/core";
import { useToast } from "../../../contexts/ToastContext";
import { Modal, SelectField, Spinner } from "../../../shared/ui";

interface Props {
  projectId: string;
  onClose: () => void;
}

export const CustomReportModal: React.FC<Props> = ({ projectId, onClose }) => {
  const toast = useToast();
  const [reportTitle, setReportTitle] = useState("");
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [language, setLanguage] = useState("ko");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    const trimmedLogo = logoUrl.trim();
    let safeLogoUrl: string | undefined;
    if (trimmedLogo) {
      try {
        const parsed = new URL(trimmedLogo);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          safeLogoUrl = trimmedLogo;
        } else {
          toast.error("로고 URL은 http:// 또는 https:// 프로토콜이어야 합니다.");
          return;
        }
      } catch {
        toast.error("로고 URL 형식이 올바르지 않습니다.");
        return;
      }
    }
    setGenerating(true);
    try {
      await generateCustomReport(projectId, {
        reportTitle: reportTitle.trim() || undefined,
        executiveSummary: executiveSummary.trim() || undefined,
        companyName: companyName.trim() || undefined,
        logoUrl: safeLogoUrl,
        language,
      });
      toast.success("커스텀 보고서가 생성되었습니다.");
      onClose();
    } catch (e) {
      logError("CustomReport.generate", e);
      toast.error("보고서 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="custom-report-modal"
      overlayClassName="custom-report-overlay"
      labelledBy="custom-report-title"
      describedBy="custom-report-desc"
    >
        <header className="custom-report-modal__header">
          <div className="custom-report-modal__header-copy">
            <h2 id="custom-report-title" className="custom-report-modal__title">
              <FileText size={16} /> 커스텀 보고서 생성
            </h2>
            <p id="custom-report-desc" className="custom-report-modal__description">
              보고서 제목, 요약, 회사 정보와 출력 언어를 지정해 맞춤형 보고서를 생성합니다.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon-sm" onClick={onClose} aria-label="커스텀 보고서 닫기">
            <X size={16} />
          </button>
        </header>
        <div className="custom-report-modal__body">
          <label className="form-label custom-report-modal__field">
            <span>보고서 제목</span>
            <input className="form-input"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="프로젝트명 + 보안 분석 보고서"
            />
          </label>
          <label className="form-label custom-report-modal__field">
            <span>요약</span>
            <textarea className="form-textarea custom-report-modal__textarea"
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              placeholder="보고서 서두에 포함할 요약문"
              rows={4}
            />
          </label>
          <label className="form-label custom-report-modal__field">
            <span>회사명</span>
            <input className="form-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="보고서에 표시할 회사명"
            />
          </label>
          <label className="form-label custom-report-modal__field">
            <span>로고 URL</span>
            <input className="form-input"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </label>
          <SelectField
            label="언어"
            name="language"
            value={language}
            onValueChange={setLanguage}
            placeholder="언어 선택"
            fieldClassName="custom-report-modal__field"
            className="custom-report-modal__select"
            options={[
              { value: "ko", label: "한국어" },
              { value: "en", label: "영어" },
            ]}
          />
        </div>
        <footer className="custom-report-modal__footer">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={generating}>취소</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating}>
            {generating ? <><Spinner size={14} /> 생성 중...</> : "보고서 생성"}
          </button>
        </footer>
    </Modal>
  );
};
