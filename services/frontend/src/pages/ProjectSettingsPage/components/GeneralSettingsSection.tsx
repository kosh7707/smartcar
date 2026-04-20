import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const GeneralSettingsSection: React.FC = () => (
  <div className="project-settings-stack">
    <Card className="project-settings-card">
      <CardContent className="project-settings-card__body">
        <div className="project-settings-section-header">
          <span className="project-settings-section-header__accent" />
          <div>
            <CardTitle className="project-settings-section-header__title">
              일반
            </CardTitle>
            <p className="project-settings-section-header__desc">
              프로젝트 이름과 설명처럼 가장 기본적인 운영 정보를 관리합니다.
            </p>
          </div>
        </div>

        <div className="project-settings-form-grid">
          <div className="project-settings-field">
            <Label className="project-settings-field__label">
              프로젝트 이름
            </Label>
            <div className="project-settings-field__row">
              <Input
                className="project-settings-field__control"
                type="text"
                placeholder="프로젝트 이름"
              />
              <Button size="sm">저장</Button>
            </div>
          </div>

          <div className="project-settings-field">
            <Label className="project-settings-field__label">설명</Label>
            <div className="project-settings-field__row project-settings-field__row--textarea">
              <Textarea
                className="project-settings-field__control project-settings-field__textarea"
                placeholder="프로젝트 설명"
                rows={3}
              />
              <Button size="sm">저장</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);
