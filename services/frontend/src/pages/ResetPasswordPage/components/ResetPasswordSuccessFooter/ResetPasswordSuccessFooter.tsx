import "./ResetPasswordSuccessFooter.css";
import React from "react";
import { Link } from "react-router-dom";

export const ResetPasswordSuccessFooter: React.FC = () => (
  <div className="form-footer chore c-9">
    <Link to="/login">로그인으로 이동</Link>
  </div>
);
