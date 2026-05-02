import "./ResetPasswordFormFooter.css";
import React from "react";
import { Link } from "react-router-dom";

export const ResetPasswordFormFooter: React.FC = () => (
  <div className="form-footer chore c-9">
    재설정을 취소하시나요? <Link to="/login">로그인</Link>
  </div>
);
