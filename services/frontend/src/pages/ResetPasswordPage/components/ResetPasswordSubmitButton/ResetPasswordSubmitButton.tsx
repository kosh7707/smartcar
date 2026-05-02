import "./ResetPasswordSubmitButton.css";
import React from "react";
import { ArrowRight } from "lucide-react";

interface ResetPasswordSubmitButtonProps {
  submitting: boolean;
  disabled: boolean;
}

export const ResetPasswordSubmitButton: React.FC<ResetPasswordSubmitButtonProps> = ({ submitting, disabled }) => (
  <button className="btn btn-primary btn-block chore c-8" type="submit" disabled={submitting || disabled}>
    {submitting ? "변경 중..." : "새 비밀번호로 설정"}
    {!submitting ? <ArrowRight aria-hidden="true" /> : null}
  </button>
);
