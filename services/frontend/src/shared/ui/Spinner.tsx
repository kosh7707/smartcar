import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  label?: string;
}

export const Spinner: React.FC<Props> = ({ size = 32, label }) => {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground" role={label ? "status" : undefined}>
      <Loader2 size={size} className={cn("animate-spin text-primary")} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
};
