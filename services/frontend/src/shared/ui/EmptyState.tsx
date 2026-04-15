import React from "react";
import { SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      <div className="empty-state--compact inline-flex items-center gap-2 rounded-md border border-dashed border-border bg-background/90 px-3 py-2 text-sm text-muted-foreground">
        <span className="empty-state--compact__title font-medium text-muted-foreground">{title}</span>
      </div>
    );
  }

  return (
    <Card className={cn("empty-state overflow-hidden border-dashed border-border/80 border-t-primary/20 bg-muted/30 shadow-none", className, className?.includes("empty-state--workspace") && "w-full max-w-5xl")}>
      <CardContent className="empty-state__surface flex min-h-56 flex-col items-start justify-center gap-4 p-6 text-left md:p-8">
        <div className="empty-state__copy flex max-w-2xl min-w-0 gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
            <SearchX size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="empty-state__title text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="empty-state__desc mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="empty-state__action mt-1 flex shrink-0 flex-wrap justify-start gap-3">{action}</div>}
      </CardContent>
    </Card>
  );
};
