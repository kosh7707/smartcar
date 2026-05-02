import "./LoginUsernameField.css";
import React from "react";
import { Mail } from "lucide-react";

interface LoginUsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const LoginUsernameField: React.FC<LoginUsernameFieldProps> = ({ value, onChange }) => (
  <div className="field chore c-5">
    <label htmlFor="login-username">이메일</label>
    <div className="input-wrap">
      <Mail className="leading" aria-hidden="true" />
      <input
        id="login-username"
        className="input"
        type="email"
        name="username"
        placeholder="analyst@company.com"
        autoComplete="username"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoFocus
      />
    </div>
  </div>
);
