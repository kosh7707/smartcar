import "./ForgotPasswordSubmitButton.css";
import React from "react";
import { ArrowRight } from "lucide-react";

interface ForgotPasswordSubmitButtonProps {
  submitting: boolean;
  disabled: boolean;
}

export const ForgotPasswordSubmitButton: React.FC<ForgotPasswordSubmitButtonProps> = ({ submitting, disabled }) => (
  <button className="btn btn-primary btn-block chore c-7" type="submit" disabled={submitting || disabled}>
    {submitting ? "발송 중..." : "재설정 링크 발송"}
    {!submitting ? <ArrowRight aria-hidden="true" /> : null}
  </button>
);
