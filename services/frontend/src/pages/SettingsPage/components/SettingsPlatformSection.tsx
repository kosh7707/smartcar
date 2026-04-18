import React from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROW_CLASS =
  "flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0";
const LABEL_CLASS = "text-sm font-semibold text-muted-foreground";
const VALUE_CLASS = "text-sm font-semibold text-foreground";

export function SettingsPlatformSection() {
  return (
    <Card className="h-full border-border/70 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
            <Info size={20} />
          </div>
          <CardTitle className="text-lg">플랫폼 정보</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 pt-4">
        <div className={ROW_CLASS}>
          <span className={LABEL_CLASS}>Platform</span>
          <span className={VALUE_CLASS}>AEGIS</span>
        </div>
        <div className={ROW_CLASS}>
          <span className={LABEL_CLASS}>Version</span>
          <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-sm text-muted-foreground">
            <code>v{__APP_VERSION__}</code>
          </span>
        </div>
        <div className={ROW_CLASS}>
          <span className={LABEL_CLASS}>License</span>
          <Badge variant="outline" className="h-auto rounded-full px-3 py-1 text-sm text-primary">
            Enterprise
          </Badge>
        </div>
        <div className={ROW_CLASS}>
          <span className={LABEL_CLASS}>Framework</span>
          <span className={VALUE_CLASS}>AEGIS</span>
        </div>
      </CardContent>
    </Card>
  );
}
