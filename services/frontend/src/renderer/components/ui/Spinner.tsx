import React from "react";
import { Loader2 } from "lucide-react";

interface Props {
  size?: number;
  label?: string;
}

export const Spinner: React.FC<Props> = ({ size = 32, label }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--cds-spacing-04)" }}>
      <Loader2 size={size} className="animate-spin" style={{ color: "var(--cds-interactive)" }} />
      {label && <span style={{ color: "var(--cds-text-secondary)", fontSize: "var(--cds-type-md)" }}>{label}</span>}
    </div>
  );
};
