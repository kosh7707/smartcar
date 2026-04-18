import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "../../../shared/ui";

type LoginFormCardProps = {
  username: string;
  password: string;
  error: string | null;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function LoginFormCard({
  username,
  password,
  error,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginFormCardProps) {
  return (
    <Card className="border-border/80 bg-card/98 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.55)]">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <PageHeader
          surface="plain"
          title="워크스페이스 열기"
          subtitle="작업자 식별 정보를 입력하면 현재 워크스페이스로 진입합니다."
        />

        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            작업자 식별 정보를 입력해 현재 작업 흐름을 이어갑니다.
          </p>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-username">사용자 이름</Label>
              <Input
                id="login-username"
                type="text"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                placeholder="name@company.com"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">비밀번호</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive" className="items-start gap-3">
                <AlertCircle className="mt-0.5 size-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="h-11 w-full justify-center gap-2 font-medium"
              disabled={submitting || !username || !password}
            >
              <span>{submitting ? "진입 중..." : "워크스페이스 열기"}</span>
              {!submitting && <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          </form>
        </div>
      </CardContent>

      <CardFooter className="justify-center px-6 py-4 sm:px-8">
        <p className="text-sm text-muted-foreground">
          처음 사용하시나요?{" "}
          <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            프로필 준비
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
