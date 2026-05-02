import "./LoginFormFooter.css";
import React from "react";
import { Link } from "react-router-dom";

export const LoginFormFooter: React.FC = () => (
  <div className="form-footer chore c-9">
    계정이 없으신가요? <Link to="/signup">가입 요청</Link>
  </div>
);
