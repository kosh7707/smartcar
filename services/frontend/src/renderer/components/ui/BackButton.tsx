import React from "react";
import { ArrowLeft } from "lucide-react";

interface Props {
  onClick: () => void;
  label?: string;
}

export const BackButton: React.FC<Props> = ({ onClick, label = "뒤로" }) => {
  return (
    <button className="btn btn-secondary btn-sm" onClick={onClick} style={{ marginBottom: "var(--cds-spacing-05)" }}>
      <ArrowLeft size={14} />
      {label}
    </button>
  );
};
