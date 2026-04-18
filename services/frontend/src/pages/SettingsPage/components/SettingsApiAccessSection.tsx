import React from "react";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TestStatus } from "../hooks/useSettingsPage";

function getStatusLabel(testStatus: TestStatus) {
  if (testStatus === "ok") return "Connected";
  if (testStatus === "error") return "Error";
  if (testStatus === "testing") return "Testing";
  return "Idle";
}

export function SettingsApiAccessSection({
  url,
  testStatus,
}: {
  url: string;
  testStatus: TestStatus;
}) {
  return (
    <Card className="h-full border-border/70 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
            <Settings size={20} />
          </div>
          <CardTitle className="text-lg">API 접근</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
          <div className="text-sm font-semibold text-muted-foreground">Endpoint</div>
          <div className="truncate font-mono text-sm text-foreground">
            {url || "http://localhost:3000"}/api/v1
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
          <div className="text-sm font-semibold text-muted-foreground">Status</div>
          <Badge
            variant="outline"
            className={cn(
              "h-auto rounded-full px-3 py-1 text-sm",
              testStatus === "ok" && "border-emerald-400/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
              testStatus === "error" && "border-destructive/50 bg-destructive/10 text-destructive",
              (testStatus === "idle" || testStatus === "testing") &&
                "text-muted-foreground",
            )}
          >
            {getStatusLabel(testStatus)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
