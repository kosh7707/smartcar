import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import "./StatCard.css";

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
        "stat-card border-border/80 bg-card/95 shadow-none transition-colors",
        accent && "stat-card--accent border-primary/30 bg-primary/5",
        onClick && "stat-card--clickable cursor-pointer hover:bg-muted/50",
      )}
      style={color ? { "--stat-accent": color } as React.CSSProperties : undefined}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="stat-card__header">
          <span className="stat-card__label text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        </div>
        <div className="stat-card__value mt-2 text-2xl font-semibold tracking-tight text-foreground" style={color ? { color } : undefined}>
          {value}
        </div>
        {detail && <div className="stat-card__detail mt-2 text-sm text-muted-foreground">{detail}</div>}
      </CardContent>
    </Card>
  );
};
