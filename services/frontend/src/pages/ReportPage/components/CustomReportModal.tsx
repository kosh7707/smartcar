import React, { useState } from "react";
import { FileText, X } from "lucide-react";
import { generateCustomReport } from "../../../api/report";
import { logError } from "../../../api/core";
import { useToast } from "../../../contexts/ToastContext";
import { Spinner } from "../../../shared/ui";
import "./CustomReportModal.css";

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
    setGenerating(true);
    try {
      await generateCustomReport(projectId, {
        reportTitle: reportTitle.trim() || undefined,
        executiveSummary: executiveSummary.trim() || undefined,
        companyName: companyName.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
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
    <div className="custom-report-overlay" onClick={onClose}>
      <div className="custom-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="custom-report-header">
          <span className="custom-report-header__title">
            <FileText size={16} /> 커스텀 보고서 생성
          </span>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="custom-report-body">
          <label className="form-field">
            <span className="form-label">보고서 제목</span>
            <input
              className="form-input"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="프로젝트명 + 보안 분석 보고서"
            />
          </label>
          <label className="form-field">
            <span className="form-label">요약</span>
            <textarea
              className="form-input custom-report-textarea"
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              placeholder="보고서 서두에 포함할 요약문"
              rows={4}
            />
          </label>
          <label className="form-field">
            <span className="form-label">회사명</span>
            <input
              className="form-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="보고서에 표시할 회사명"
            />
          </label>
          <label className="form-field">
            <span className="form-label">로고 URL</span>
            <input
              className="form-input"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </label>
          <label className="form-field">
            <span className="form-label">언어</span>
            <select className="form-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="ko">한국어</option>
              <option value="en">영어</option>
            </select>
          </label>
        </div>
        <div className="custom-report-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={generating}>취소</button>
          <button className="btn" onClick={handleGenerate} disabled={generating}>
            {generating ? <><Spinner size={14} /> 생성 중...</> : "보고서 생성"}
          </button>
        </div>
      </div>
    </div>
  );
};
