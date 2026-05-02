import "./SignupFullNameField.css";
import React from "react";
import { User } from "lucide-react";

interface SignupFullNameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const SignupFullNameField: React.FC<SignupFullNameFieldProps> = ({ value, onChange }) => (
  <div className="field">
    <label htmlFor="signup-fullname">이름</label>
    <div className="input-wrap">
      <User className="leading" aria-hidden="true" />
      <input
        id="signup-fullname"
        className="input"
        type="text"
        placeholder="홍길동"
        autoComplete="name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  </div>
);
