import React from "react";
import { Loader2 } from "lucide-react";

interface Props {
  size?: number;
  label?: string;
}

export const Spinner: React.FC<Props> = ({ size = 32, label }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
      <Loader2 size={size} className="animate-spin" style={{ color: "var(--accent)" }} />
      {label && <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-md)" }}>{label}</span>}
    </div>
  );
};
