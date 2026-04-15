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
      className="confirm-dialog approval-dialog max-w-md gap-0 border-border bg-card p-0 shadow-2xl sm:max-w-md"
      overlayClassName="confirm-overlay"
      onOverlayClick={onClose}
      showCloseButton={false}
    >
      <DialogHeader className="border-b border-border px-5 py-4">
        <DialogTitle className="confirm-dialog__title">
          {action === "approved" ? "승인 확인" : "거부 확인"}
        </DialogTitle>
        <DialogDescription className="approval-dialog__subtitle">
          결정 사유를 남기면 이후 감사 추적과 승인 이력 검토에 도움이 됩니다.
        </DialogDescription>
      </DialogHeader>
      <div className="px-5 py-4">
        <Textarea
          className="approval-dialog__comment-input min-h-24"
          rows={4}
          placeholder="코멘트 (선택)"
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
        />
      </div>
      <DialogFooter className="confirm-dialog__actions flex-row justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
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
