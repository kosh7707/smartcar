import "./SignupResetButton.css";
import React from "react";

interface SignupResetButtonProps {
  onClick: () => void;
}

export const SignupResetButton: React.FC<SignupResetButtonProps> = ({ onClick }) => (
  <button className="btn btn-ghost btn-block chore c-9" type="button" onClick={onClick}>
    다시 요청 작성
  </button>
);
