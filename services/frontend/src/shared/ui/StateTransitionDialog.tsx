import React, { useState, useEffect } from "react";
import type { FindingStatus, FindingSourceType } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FINDING_STATUS_LABELS,
  ALLOWED_TRANSITIONS,
  canTransitionTo,
} from "../../constants/finding";
import "./StateTransitionDialog.css";

interface Props {
  open: boolean;
  currentStatus: FindingStatus;
  sourceType: FindingSourceType;
  onConfirm: (newStatus: FindingStatus, reason: string) => void;
  onCancel: () => void;
}

export const StateTransitionDialog: React.FC<Props> = ({
  open,
  currentStatus,
  sourceType,
  onConfirm,
  onCancel,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<FindingStatus | "">("");
  const [reason, setReason] = useState("");

  const availableTransitions = ALLOWED_TRANSITIONS[currentStatus].filter((to) =>
    canTransitionTo(currentStatus, to, sourceType),
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedStatus("");
      setReason("");
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = selectedStatus !== "" && reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent className="state-dialog sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="confirm-dialog__title">상태 변경</DialogTitle>
          <DialogDescription>
            탐지 항목의 상태를 바꾸려면 새 상태와 변경 사유를 남기세요.
          </DialogDescription>
        </DialogHeader>

        <div className="state-dialog__field">
          <Label className="state-dialog__label">현재 상태</Label>
          <Badge variant="outline" className={`badge-status--${currentStatus}`}>
            {FINDING_STATUS_LABELS[currentStatus]}
          </Badge>
        </div>

        <div className="state-dialog__field">
          <Label className="state-dialog__label" htmlFor="state-select">새 상태</Label>
          <Select
            value={selectedStatus}
            onValueChange={(nextStatus) => setSelectedStatus(nextStatus as FindingStatus)}
          >
            <SelectTrigger id="state-select" className="state-dialog__select w-full">
              <SelectValue placeholder="선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {availableTransitions.map((s) => (
                <SelectItem key={s} value={s}>
                  {FINDING_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="state-dialog__field">
          <Label className="state-dialog__label" htmlFor="state-reason">사유</Label>
          <Textarea
            id="state-reason"
            className="state-dialog__textarea"
            rows={3}
            placeholder="상태 변경 사유를 입력하세요 (필수)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter className="confirm-dialog__actions">
          <Button variant="outline" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={() => {
              if (canSubmit) onConfirm(selectedStatus as FindingStatus, reason.trim());
            }}
          >
            변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
