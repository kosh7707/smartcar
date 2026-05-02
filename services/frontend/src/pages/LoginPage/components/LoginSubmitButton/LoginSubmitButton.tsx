import "./LoginSubmitButton.css";
import React from "react";
import { ArrowRight } from "lucide-react";

interface LoginSubmitButtonProps {
  submitting: boolean;
  disabled: boolean;
}

export const LoginSubmitButton: React.FC<LoginSubmitButtonProps> = ({ submitting, disabled }) => (
  <button className="btn btn-primary btn-block chore c-8" type="submit" disabled={submitting || disabled}>
    {submitting ? "진입 중..." : "로그인"}
    {!submitting ? <ArrowRight aria-hidden="true" /> : null}
  </button>
);
