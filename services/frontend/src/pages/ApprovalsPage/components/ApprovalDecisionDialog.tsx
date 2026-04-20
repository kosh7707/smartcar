import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalDecisionAction } from "../hooks/useApprovalsPage";

interface ApprovalDecisionDialogProps {
  action: ApprovalDecisionAction;
  comment: string;
  processing: boolean;
  onClose: () => void;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
}

export const ApprovalDecisionDialog: React.FC<ApprovalDecisionDialogProps> = ({
  action,
  comment,
  processing,
  onClose,
  onCommentChange,
  onConfirm,
}) => (
  <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
    <DialogContent
      className="confirm-dialog approval-decision-dialog"
      overlayClassName="confirm-overlay"
      onOverlayClick={onClose}
      showCloseButton={false}
    >
      <DialogHeader className="approval-decision-dialog__header">
        <DialogTitle className="confirm-dialog__title">
          {action === "approved" ? "승인 확인" : "거부 확인"}
        </DialogTitle>
        <DialogDescription className="approval-decision-dialog__description">
          결정 사유를 남기면 이후 감사 추적과 승인 이력 검토에 도움이 됩니다.
        </DialogDescription>
      </DialogHeader>
      <div className="approval-decision-dialog__body">
        <Textarea
          className="approval-decision-dialog__textarea"
          rows={4}
          placeholder="코멘트 (선택)"
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
        />
      </div>
      <DialogFooter className="confirm-dialog__actions approval-decision-dialog__footer">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          취소
        </Button>
        <Button
          type="button"
          variant={action === "rejected" ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={processing}
        >
          {processing ? "처리 중..." : action === "approved" ? "승인" : "거부"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
