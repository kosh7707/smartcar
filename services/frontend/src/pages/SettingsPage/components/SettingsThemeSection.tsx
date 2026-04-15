import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ThemePreference } from "../../../utils/theme";

type SettingsThemeSectionProps = { theme: ThemePreference; onThemeChange: (value: ThemePreference) => void; };
const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
  { value: "light", icon: <Sun size={16} />, label: "라이트" },
  { value: "dark", icon: <Moon size={16} />, label: "다크" },
  { value: "system", icon: <Monitor size={16} />, label: "시스템" },
];

export function SettingsThemeSection({ theme, onThemeChange }: SettingsThemeSectionProps) {
  return (
    <Card className="gs-section gs-section--surface gs-bento__col-7 shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="gs-section__header"><div className="gs-section__icon"><Sun size={20} /></div><h3 className="gs-section__title">테마</h3></div>
        <p className="gs-section__description">애플리케이션 테마를 설정합니다.</p>
        <div className="gs-theme-options">
          {THEME_OPTIONS.map((option) => <Button key={option.value} type="button" variant={theme === option.value ? "default" : "outline"} className={`gs-theme-btn${theme === option.value ? " gs-theme-btn--active" : ""}`} onClick={() => onThemeChange(option.value)}>{option.icon}<span>{option.label}</span></Button>)}
        </div>
      </CardContent>
    </Card>
  );
}
