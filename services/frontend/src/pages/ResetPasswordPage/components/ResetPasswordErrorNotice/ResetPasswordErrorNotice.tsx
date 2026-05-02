import "./ResetPasswordErrorNotice.css";
import React from "react";
import { Info } from "lucide-react";

interface ResetPasswordErrorNoticeProps {
  message: string;
}

export const ResetPasswordErrorNotice: React.FC<ResetPasswordErrorNoticeProps> = ({ message }) => (
  <div className="notice notice--danger chore c-7" role="alert">
    <Info aria-hidden="true" />
    <div>{message}</div>
  </div>
);
