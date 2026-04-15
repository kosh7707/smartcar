import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "../../../shared/ui";

type LoginFormCardProps = { username: string; password: string; error: string | null; submitting: boolean; onUsernameChange: (value: string) => void; onPasswordChange: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; };

export function LoginFormCard({ username, password, error, submitting, onUsernameChange, onPasswordChange, onSubmit }: LoginFormCardProps) {
  return (
    <Card className="login-card border-border/80 bg-card/95 shadow-none">
      <CardContent className="space-y-5 p-6">
        <PageHeader surface="plain" title="워크스페이스 열기" subtitle="작업자 식별 정보를 입력하면 현재 워크스페이스로 진입합니다." />
        <div className="login-form-section space-y-4">
          <p className="login-form-heading text-sm text-muted-foreground">작업자 식별 정보를 입력해 현재 작업 흐름을 이어갑니다.</p>
          <form className="login-form space-y-4" onSubmit={onSubmit}>
            <div className="login-field space-y-2"><Label htmlFor="login-username">사용자 이름</Label><Input id="login-username" type="text" value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="name@company.com" autoFocus required /></div>
            <div className="login-field space-y-2"><Label htmlFor="login-password">비밀번호</Label><Input id="login-password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="••••••••" required /></div>
            {error && <Alert variant="destructive" className="login-error"><AlertCircle size={16} /><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" className="login-submit w-full" disabled={submitting || !username || !password}>{submitting ? "진입 중..." : "워크스페이스 열기"}</Button>
          </form>
        </div>
      </CardContent>
      <CardFooter className="login-card__footer-section justify-center border-t bg-muted/30 p-4"><p className="login-card__footer text-sm text-muted-foreground">처음 사용하시나요? <Link to="/signup" className="login-card__link text-primary hover:underline">프로필 준비</Link></p></CardFooter>
    </Card>
  );
}
