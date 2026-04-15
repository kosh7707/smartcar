import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import "./PageHeader.css";

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  surface?: "card" | "plain";
}

export const PageHeader: React.FC<Props> = ({
  title,
  subtitle,
  action,
  surface = "card",
}) => {
  const body = (
    <>
      <div className="page-header__left min-w-0">
        <div className="page-header__text min-w-0">
          <h2 className="page-header__title text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="page-header__subtitle mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="page-header__action flex shrink-0 items-center gap-2">{action}</div>}
    </>
  );

  if (surface === "plain") {
    return (
      <div className="page-header page-header--plain flex items-start justify-between gap-4 border-b border-border/70 pb-4">
        {body}
      </div>
    );
  }

  return (
    <Card className={cn("page-header page-header--card border-border/80 bg-card/95 shadow-none")}>
      <CardContent className="flex items-start justify-between gap-4 p-0">
        {body}
      </CardContent>
    </Card>
  );
};
