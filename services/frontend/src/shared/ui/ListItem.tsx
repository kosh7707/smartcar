import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import "./ListItem.css";

interface Props {
  onClick?: () => void;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  divider?: boolean;
}

export const ListItem: React.FC<Props> = ({ onClick, children, trailing, showChevron = true, divider = true }) => {
  return (
    <div
      className={cn(
        "list-item flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        onClick && "list-item--clickable cursor-pointer hover:bg-muted/70",
        divider && "list-item--divider border-b border-border/60",
      )}
      onClick={onClick}
    >
      <div className="list-item__content min-w-0 flex-1">{children}</div>
      {(trailing || (showChevron && onClick)) && (
        <div className="list-item__trailing flex shrink-0 items-center gap-2 text-muted-foreground">
          {trailing}
          {showChevron && onClick && <ChevronRight size={14} className="list-item__chevron" />}
        </div>
      )}
    </div>
  );
};
