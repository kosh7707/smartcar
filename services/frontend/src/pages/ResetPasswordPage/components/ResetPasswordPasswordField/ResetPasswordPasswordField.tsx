import "./ResetPasswordPasswordField.css";
import React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

interface ResetPasswordPasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  meetsLength: boolean;
}

export const ResetPasswordPasswordField: React.FC<ResetPasswordPasswordFieldProps> = ({ value, onChange, showPassword, onToggleVisibility, meetsLength }) => (
  <div className="field chore c-5">
    <label htmlFor="reset-password">새 비밀번호</label>
    <div className="input-wrap">
      <Lock className="leading" aria-hidden="true" />
      <input
        id="reset-password"
        className="input"
        type={showPassword ? "text" : "password"}
        placeholder="최소 8자 · 대소문자 · 숫자 · 특수문자"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoFocus
      />
      <button
        type="button"
        className="trailing-btn"
        onClick={onToggleVisibility}
        aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
      >
        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
    {value.length > 0 && !meetsLength ? (
      <div className="hint hint--danger">최소 8자 이상 입력해 주세요.</div>
    ) : null}
  </div>
);
