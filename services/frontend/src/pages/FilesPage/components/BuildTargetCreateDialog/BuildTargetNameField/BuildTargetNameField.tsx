import "./BuildTargetNameField.css";
import React from "react";

interface BuildTargetNameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const BuildTargetNameField: React.FC<BuildTargetNameFieldProps> = ({ value, onChange }) => (
  <label className="form-label build-target-create-dialog__field">
    <span>BuildTarget 이름</span>
    <input
      className="form-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="예: gateway-module"
      autoFocus
    />
  </label>
);
