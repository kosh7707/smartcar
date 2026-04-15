import React from "react";
import { SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import "./EmptyState.css";

interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<Props> = ({ title, description, action, compact, className }) => {
  if (compact) {
    return (
      <div className="empty-state--compact inline-flex items-center rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        <span className="empty-state--compact__title">{title}</span>
      </div>
    );
  }

  return (
    <Card className={cn("empty-state border-dashed border-border/80 bg-muted/30 shadow-none", className)}>
      <CardContent className="empty-state__surface flex items-start justify-between gap-4 p-6">
        <div className="empty-state__copy flex min-w-0 gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
            <SearchX size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="empty-state__title text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="empty-state__desc mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="empty-state__action shrink-0">{action}</div>}
      </CardContent>
    </Card>
  );
};
