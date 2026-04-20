import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onClick: () => void;
  label?: string;
}

export const BackButton: React.FC<Props> = ({ onClick, label = "뒤로" }) => {
  return (
    <Button variant="outline" size="sm" className="back-button" onClick={onClick}>
      <ArrowLeft size={14} />
      {label}
    </Button>
  );
};
