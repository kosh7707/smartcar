import "./SettingsThemeSection.css";
import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/common/utils/cn";
import type { ThemePreference } from "@/common/utils/theme";

type SettingsThemeSectionProps = {
  theme: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
};

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "light", icon: <Sun size={14} />, label: "라이트" },
  { value: "dark", icon: <Moon size={14} />, label: "다크" },
  { value: "system", icon: <Monitor size={14} />, label: "시스템" },
];

export function SettingsThemeSection({
  theme,
  onThemeChange,
}: SettingsThemeSectionProps) {
  return (
    <div className="settings-field">
      <span className="settings-field__label">테마</span>
      <p className="settings-field__hint">
        시스템을 선택하면 OS 설정을 따릅니다.
      </p>
      <div className="settings-theme-seg" role="group" aria-label="테마 선택">
        {THEME_OPTIONS.map((option) => {
          const active = theme === option.value;
          return (
            <button
              type="button"
              key={option.value}
              aria-pressed={active}
              className={cn(
                "settings-theme-seg__option",
                active && "settings-theme-seg__option--active",
              )}
              onClick={() => onThemeChange(option.value)}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
