import React from "react";
import { ArrowLeft } from "lucide-react";

interface Props {
  onClick: () => void;
  label?: string;
}

export const BackButton: React.FC<Props> = ({ onClick, label = "뒤로" }) => (
  <button type="button" className="btn btn-ghost btn-sm back-button" onClick={onClick}>
    <ArrowLeft size={14} />
    {label}
  </button>
);
