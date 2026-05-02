import "./SignupErrorNotice.css";
import React from "react";
import { AlertCircle } from "lucide-react";

interface SignupErrorNoticeProps {
  message: string;
}

export const SignupErrorNotice: React.FC<SignupErrorNoticeProps> = ({ message }) => (
  <div className="notice notice--danger chore c-9" role="alert">
    <AlertCircle aria-hidden="true" />
    <div>{message}</div>
  </div>
);
