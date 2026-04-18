import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ThemePreference } from "../../../utils/theme";

type SettingsThemeSectionProps = {
  theme: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
};
const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "light", icon: <Sun size={16} />, label: "라이트" },
  { value: "dark", icon: <Moon size={16} />, label: "다크" },
  { value: "system", icon: <Monitor size={16} />, label: "시스템" },
];

export function SettingsThemeSection({
  theme,
  onThemeChange,
}: SettingsThemeSectionProps) {
  return (
    <Card className="h-full border-border/70 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
            <Sun size={20} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg">테마</CardTitle>
            <p className="text-sm text-muted-foreground">
              애플리케이션 테마를 설정합니다.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={theme === option.value ? "default" : "outline"}
              className="min-h-9 rounded-full px-4 text-sm"
              onClick={() => onThemeChange(option.value)}
            >
              {option.icon}
              <span>{option.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
