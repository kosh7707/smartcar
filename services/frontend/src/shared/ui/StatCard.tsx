import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number | string;
  color?: string;
  accent?: boolean;
  onClick?: () => void;
  detail?: React.ReactNode;
}

export const StatCard: React.FC<Props> = ({ label, value, color, accent, onClick, detail }) => {
  return (
    <Card
      className={cn(
        "min-w-30 flex-1 overflow-hidden rounded-lg border-border/80 border-l-[3px] bg-gradient-to-b from-background to-muted/50 shadow-none transition-colors hover:border-primary/40",
        accent && "border-primary/30 bg-primary/5",
        onClick && "cursor-pointer hover:bg-muted/50",
      )}
      style={{ borderLeftColor: color ?? (accent ? "var(--primary)" : "var(--border)") }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold leading-none tracking-tight text-foreground" style={color ? { color } : undefined}>
          {value}
        </div>
        {detail && <div className="mt-2 text-sm leading-snug text-muted-foreground">{detail}</div>}
      </CardContent>
    </Card>
  );
};
