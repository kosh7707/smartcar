import "./SignupFormFooter.css";
import React from "react";
import { Link } from "react-router-dom";

export const SignupFormFooter: React.FC = () => (
  <div className="form-footer chore c-9">
    이미 계정이 있으신가요? <Link to="/login">로그인</Link>
  </div>
);
