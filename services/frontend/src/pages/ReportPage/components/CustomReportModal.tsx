import React, { useState } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="custom-report-modal max-w-xl gap-0 border-border bg-card p-0 shadow-2xl sm:max-w-xl"
        overlayClassName="custom-report-overlay"
        onOverlayClick={onClose}
        showCloseButton={false}
      >
        <DialogHeader className="custom-report-header flex-row items-center justify-between space-y-0 border-b border-border px-5 py-4">
          <DialogTitle className="custom-report-header__title">
            <FileText size={16} /> 커스텀 보고서 생성
          </DialogTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="커스텀 보고서 닫기">
            <X size={16} />
          </Button>
        </DialogHeader>
        <div className="custom-report-body px-5 py-4">
          <Label className="form-field">
            <span className="form-label">보고서 제목</span>
            <Input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="프로젝트명 + 보안 분석 보고서"
            />
          </Label>
          <Label className="form-field">
            <span className="form-label">요약</span>
            <Textarea
              className="custom-report-textarea"
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              placeholder="보고서 서두에 포함할 요약문"
              rows={4}
            />
          </Label>
          <Label className="form-field">
            <span className="form-label">회사명</span>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="보고서에 표시할 회사명"
            />
          </Label>
          <Label className="form-field">
            <span className="form-label">로고 URL</span>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </Label>
          <Label className="form-field">
            <span className="form-label">언어</span>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="ko">한국어</option>
              <option value="en">영어</option>
            </select>
          </Label>
        </div>
        <DialogFooter className="custom-report-footer flex-row justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={generating}>취소</Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <><Spinner size={14} /> 생성 중...</> : "보고서 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
