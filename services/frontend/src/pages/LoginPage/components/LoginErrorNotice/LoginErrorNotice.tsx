import "./LoginErrorNotice.css";
import React from "react";
import { AlertCircle } from "lucide-react";

interface LoginErrorNoticeProps {
  message: string;
}

export const LoginErrorNotice: React.FC<LoginErrorNoticeProps> = ({ message }) => (
  <div className="notice notice--danger chore c-8" role="alert">
    <AlertCircle aria-hidden="true" />
    <div>{message}</div>
  </div>
);
