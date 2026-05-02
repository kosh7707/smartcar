import "./SignupPasswordField.css";
import React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { SignupPasswordStrengthMeter } from "../SignupPasswordStrengthMeter/SignupPasswordStrengthMeter";

interface SignupPasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  strengthLevel: number;
  strengthTicks: string;
  strengthLabel: string;
}

export const SignupPasswordField: React.FC<SignupPasswordFieldProps> = ({
  value,
  onChange,
  showPassword,
  onToggleVisibility,
  strengthLevel,
  strengthTicks,
  strengthLabel,
}) => (
  <div className="field">
    <label htmlFor="signup-password">비밀번호</label>
    <div className="input-wrap">
      <Lock className="leading" aria-hidden="true" />
      <input
        id="signup-password"
        className="input"
        type={showPassword ? "text" : "password"}
        placeholder="최소 8자 · 대소문자 · 숫자 · 특수문자"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        type="button"
        className="trailing-btn"
        onClick={onToggleVisibility}
        aria-label={showPassword ? "가입 비밀번호 숨기기" : "가입 비밀번호 보기"}
      >
        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
    <SignupPasswordStrengthMeter level={strengthLevel} ticks={strengthTicks} label={strengthLabel} />
  </div>
);
