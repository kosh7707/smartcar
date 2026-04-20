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
    <Card className="settings-theme-card">
      <CardHeader className="settings-theme-card__head">
        <div className="settings-theme-card__title-row">
          <div className="settings-theme-card__icon-shell">
            <Sun size={20} />
          </div>
          <div className="settings-theme-card__copy">
            <CardTitle className="settings-theme-card__title">테마</CardTitle>
            <p className="settings-theme-card__description">
              애플리케이션 테마를 설정합니다.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="settings-theme-card__body">
        <div className="settings-theme-card__options">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={theme === option.value ? "default" : "outline"}
              className="settings-theme-card__option"
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
