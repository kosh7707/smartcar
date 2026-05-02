import "./ForgotPasswordErrorNotice.css";
import React from "react";
import { Info } from "lucide-react";

interface ForgotPasswordErrorNoticeProps {
  message: string;
}

export const ForgotPasswordErrorNotice: React.FC<ForgotPasswordErrorNoticeProps> = ({ message }) => (
  <div className="notice notice--danger chore c-6" role="alert">
    <Info aria-hidden="true" />
    <div>{message}</div>
  </div>
);
