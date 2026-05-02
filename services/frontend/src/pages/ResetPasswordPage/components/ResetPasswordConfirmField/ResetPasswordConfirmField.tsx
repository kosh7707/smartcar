import "./ResetPasswordConfirmField.css";
import React from "react";
import { Lock } from "lucide-react";

interface ResetPasswordConfirmFieldProps {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  passwordsMatch: boolean;
}

export const ResetPasswordConfirmField: React.FC<ResetPasswordConfirmFieldProps> = ({ value, onChange, showPassword, passwordsMatch }) => (
  <div className="field chore c-6">
    <label htmlFor="reset-confirm">새 비밀번호 확인</label>
    <div className="input-wrap">
      <Lock className="leading" aria-hidden="true" />
      <input
        id="reset-confirm"
        className="input"
        type={showPassword ? "text" : "password"}
        placeholder="새 비밀번호 재입력"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
    {value.length > 0 && !passwordsMatch ? (
      <div className="hint hint--danger">비밀번호가 일치하지 않습니다.</div>
    ) : null}
  </div>
);
