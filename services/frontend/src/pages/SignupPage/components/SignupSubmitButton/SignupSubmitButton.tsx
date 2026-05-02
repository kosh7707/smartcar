import "./SignupSubmitButton.css";
import React from "react";
import { ArrowRight } from "lucide-react";

interface SignupSubmitButtonProps {
  submitting: boolean;
  disabled: boolean;
}

export const SignupSubmitButton: React.FC<SignupSubmitButtonProps> = ({ submitting, disabled }) => (
  <button className="btn btn-primary btn-block chore c-9" type="submit" disabled={submitting || disabled}>
    {submitting ? "요청 제출 중..." : "가입 요청 제출"}
    {!submitting ? <ArrowRight aria-hidden="true" /> : null}
  </button>
);
