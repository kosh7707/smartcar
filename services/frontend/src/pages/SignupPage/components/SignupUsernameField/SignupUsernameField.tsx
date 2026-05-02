import "./SignupUsernameField.css";
import React from "react";
import { Mail } from "lucide-react";

interface SignupUsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const SignupUsernameField: React.FC<SignupUsernameFieldProps> = ({ value, onChange }) => (
  <div className="field">
    <label htmlFor="signup-username">업무용 이메일</label>
    <div className="input-wrap">
      <Mail className="leading" aria-hidden="true" />
      <input
        id="signup-username"
        className="input"
        type="email"
        placeholder="analyst@company.com"
        autoComplete="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
    <div className="hint">개인 이메일은 승인되지 않을 수 있습니다.</div>
  </div>
);
