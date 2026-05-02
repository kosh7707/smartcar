import "./SignupAccountSection.css";
import React from "react";
import { SignupFullNameField } from "../SignupFullNameField/SignupFullNameField";
import { SignupUsernameField } from "../SignupUsernameField/SignupUsernameField";
import { SignupPasswordField } from "../SignupPasswordField/SignupPasswordField";

interface SignupAccountSectionProps {
  fullName: string;
  username: string;
  password: string;
  showPassword: boolean;
  strengthLevel: number;
  strengthTicks: string;
  strengthLabel: string;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordVisibilityToggle: () => void;
}

export const SignupAccountSection: React.FC<SignupAccountSectionProps> = ({
  fullName,
  username,
  password,
  showPassword,
  strengthLevel,
  strengthTicks,
  strengthLabel,
  onFullNameChange,
  onUsernameChange,
  onPasswordChange,
  onPasswordVisibilityToggle,
}) => (
  <div className="section-group chore c-6">
    <div className="rail">
      <div className="num">01</div>
      <div className="line"></div>
    </div>
    <div className="body">
      <div className="section-header">
        <span className="title">계정 정보</span>
      </div>
      <SignupFullNameField value={fullName} onChange={onFullNameChange} />
      <SignupUsernameField value={username} onChange={onUsernameChange} />
      <SignupPasswordField
        value={password}
        onChange={onPasswordChange}
        showPassword={showPassword}
        onToggleVisibility={onPasswordVisibilityToggle}
        strengthLevel={strengthLevel}
        strengthTicks={strengthTicks}
        strengthLabel={strengthLabel}
      />
    </div>
  </div>
);
