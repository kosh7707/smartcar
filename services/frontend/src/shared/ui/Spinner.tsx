import React from "react";
import { Loader2 } from "lucide-react";

interface Props {
  size?: number;
  label?: string;
}

export const Spinner: React.FC<Props> = ({ size = 32, label }) => {
  return (
    <div
      className="placeholder-card spinner-card"
      role={label ? "status" : undefined}
    >
      <Loader2 size={size} className="animate-spin spinner-icon" />
      {label ? <p className="spinner-label">{label}</p> : null}
    </div>
  );
};
