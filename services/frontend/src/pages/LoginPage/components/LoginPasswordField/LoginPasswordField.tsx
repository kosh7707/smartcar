import "./LoginPasswordField.css";
import React from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";

interface LoginPasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
}

export const LoginPasswordField: React.FC<LoginPasswordFieldProps> = ({ value, onChange, showPassword, onToggleVisibility }) => (
  <div className="field chore c-6">
    <label htmlFor="login-password">
      <span>비밀번호</span>
      <Link to="/forgot-password">잊으셨나요?</Link>
    </label>
    <div className="input-wrap">
      <Lock className="leading" aria-hidden="true" />
      <input
        id="login-password"
        className="input"
        type={showPassword ? "text" : "password"}
        name="password"
        placeholder="••••••••"
        autoComplete="current-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        type="button"
        className="trailing-btn"
        onClick={onToggleVisibility}
        aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
      >
        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {showPassword ? "hide" : "show"}
      </button>
    </div>
  </div>
);
