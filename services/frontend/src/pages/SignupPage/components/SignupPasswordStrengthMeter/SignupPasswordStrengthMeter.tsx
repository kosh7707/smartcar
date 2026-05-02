import "./SignupPasswordStrengthMeter.css";
import React from "react";

interface SignupPasswordStrengthMeterProps {
  level: number;
  ticks: string;
  label: string;
}

export const SignupPasswordStrengthMeter: React.FC<SignupPasswordStrengthMeterProps> = ({ level, ticks, label }) => (
  <div className="strength" data-level={level}>
    <div className="strength-ticks">{ticks}</div>
    <div className="strength-label">{label}</div>
  </div>
);
