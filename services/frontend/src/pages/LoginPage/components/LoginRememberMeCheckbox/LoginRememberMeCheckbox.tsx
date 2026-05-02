import "./LoginRememberMeCheckbox.css";
import React from "react";
import { Check } from "lucide-react";

interface LoginRememberMeCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const LoginRememberMeCheckbox: React.FC<LoginRememberMeCheckboxProps> = ({ checked, onChange }) => (
  <label className="checkbox-row chore c-7">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="box"><Check /></span>
    <span>이 기기에서 로그인 유지</span>
  </label>
);
