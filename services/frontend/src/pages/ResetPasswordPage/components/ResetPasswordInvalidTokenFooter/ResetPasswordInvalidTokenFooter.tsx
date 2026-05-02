import "./ResetPasswordInvalidTokenFooter.css";
import React from "react";
import { Link } from "react-router-dom";

export const ResetPasswordInvalidTokenFooter: React.FC = () => (
  <div className="form-footer chore c-9">
    <Link to="/forgot-password">비밀번호 재설정 요청</Link>
  </div>
);
