import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "list-item group/list-item flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        onClick && "list-item--clickable cursor-pointer hover:bg-muted/70",
        divider && "list-item--divider border-b border-border/60",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => { if (event.key === "Enter") onClick(); } : undefined}
    >
      <div className="list-item__content min-w-0 flex-1">{children}</div>
      {(trailing || (showChevron && onClick)) && (
        <div className="list-item__trailing flex shrink-0 items-center gap-2 text-muted-foreground">
          {trailing}
          {showChevron && onClick && <ChevronRight size={14} className="list-item__chevron text-muted-foreground transition-transform group-hover/list-item:translate-x-0.5" />}
        </div>
      )}
    </div>
  );
};
