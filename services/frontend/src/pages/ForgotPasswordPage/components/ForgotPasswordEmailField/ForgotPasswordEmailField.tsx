import "./ForgotPasswordEmailField.css";
import React from "react";
import { Mail } from "lucide-react";

interface ForgotPasswordEmailFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const ForgotPasswordEmailField: React.FC<ForgotPasswordEmailFieldProps> = ({ value, onChange }) => (
  <div className="field chore c-5">
    <label htmlFor="forgot-email">이메일</label>
    <div className="input-wrap">
      <Mail className="leading" aria-hidden="true" />
      <input
        id="forgot-email"
        className="input"
        type="email"
        placeholder="analyst@company.com"
        autoComplete="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoFocus
      />
    </div>
    <div className="hint">가입 시 입력한 업무용 이메일을 사용해 주세요.</div>
  </div>
);
