import React from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsPlatformSection() {
  return (
    <Card className="settings-platform-card">
      <CardHeader className="settings-platform-card__head">
        <div className="settings-platform-card__title-row">
          <div className="settings-platform-card__icon-shell">
            <Info size={20} />
          </div>
          <CardTitle className="settings-platform-card__title">플랫폼 정보</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="settings-platform-card__body">
        <div className="settings-platform-card__row">
          <span className="settings-platform-card__label">Platform</span>
          <span className="settings-platform-card__value">AEGIS</span>
        </div>
        <div className="settings-platform-card__row">
          <span className="settings-platform-card__label">Version</span>
          <span className="settings-platform-card__version">
            <code>v{__APP_VERSION__}</code>
          </span>
        </div>
        <div className="settings-platform-card__row">
          <span className="settings-platform-card__label">License</span>
          <Badge variant="outline" className="settings-platform-card__license">
            Enterprise
          </Badge>
        </div>
        <div className="settings-platform-card__row">
          <span className="settings-platform-card__label">Framework</span>
          <span className="settings-platform-card__value">AEGIS</span>
        </div>
      </CardContent>
    </Card>
  );
}
