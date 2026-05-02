import "./ForgotPasswordRetryButton.css";
import React from "react";

interface ForgotPasswordRetryButtonProps {
  onClick: () => void;
}

export const ForgotPasswordRetryButton: React.FC<ForgotPasswordRetryButtonProps> = ({ onClick }) => (
  <button className="btn btn-ghost btn-block chore c-9" type="button" onClick={onClick}>
    다른 이메일로 다시 요청
  </button>
);
