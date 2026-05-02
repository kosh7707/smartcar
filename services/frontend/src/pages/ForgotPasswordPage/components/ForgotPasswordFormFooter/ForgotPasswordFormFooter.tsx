import "./ForgotPasswordFormFooter.css";
import React from "react";
import { Link } from "react-router-dom";

export const ForgotPasswordFormFooter: React.FC = () => (
  <div className="form-footer chore c-9">
    비밀번호가 기억나셨나요? <Link to="/login">로그인</Link>
  </div>
);
