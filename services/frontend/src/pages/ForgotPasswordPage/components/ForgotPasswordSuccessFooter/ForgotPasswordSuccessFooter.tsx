import "./ForgotPasswordSuccessFooter.css";
import React from "react";
import { Link } from "react-router-dom";

export const ForgotPasswordSuccessFooter: React.FC = () => (
  <div className="form-footer chore c-9">
    <Link to="/login">로그인으로 돌아가기</Link>
  </div>
);
