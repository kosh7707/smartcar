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
import { findingStatusBadgeClass } from "./FindingStatusBadge";

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
      <DialogContent className="max-w-[440px] sm:max-w-[440px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>상태 변경</DialogTitle>
          <DialogDescription>
            탐지 항목의 상태를 바꾸려면 새 상태와 변경 사유를 남기세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <Label>현재 상태</Label>
            <Badge variant="outline" className={`${findingStatusBadgeClass(currentStatus)} w-fit`}>
              {FINDING_STATUS_LABELS[currentStatus]}
            </Badge>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="state-select">새 상태</Label>
            <Select
              value={selectedStatus}
              onValueChange={(nextStatus) => setSelectedStatus(nextStatus as FindingStatus)}
            >
              <SelectTrigger id="state-select" className="w-full">
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="state-reason">사유</Label>
            <Textarea
              id="state-reason"
              className="min-h-[72px] resize-y"
              rows={3}
              placeholder="상태 변경 사유를 입력하세요 (필수)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
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
