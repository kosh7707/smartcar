import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "../../../shared/ui";

type SignupFormCardProps = {
  username: string;
  password: string;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function SignupFormCard({
  username,
  password,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: SignupFormCardProps) {
  return (
    <Card className="border-border/80 bg-card/98 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.55)]">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <PageHeader
          surface="plain"
          title="프로필 준비"
          subtitle="워크스페이스에 표시할 작업자 정보를 먼저 정리합니다."
        />

        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            현재 데모 워크스페이스에 사용할 작업자 정보를 입력합니다.
          </p>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="signup-fullname">Full name</Label>
              <Input id="signup-fullname" type="text" placeholder="Enter your full name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-username">사용자 이름</Label>
              <Input
                id="signup-username"
                type="text"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                placeholder="name@company.com"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">비밀번호</Label>
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Create a password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-confirm">Confirm password</Label>
              <Input id="signup-confirm" type="password" placeholder="Confirm your password" />
            </div>

            <Button
              type="submit"
              className="h-11 w-full justify-center gap-2 font-medium"
              disabled={submitting || !username || !password}
            >
              <span>{submitting ? "준비 중..." : "프로필 준비"}</span>
              {!submitting && <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          </form>
        </div>
      </CardContent>

      <CardFooter className="justify-center px-6 py-4 sm:px-8">
        <p className="text-sm text-muted-foreground">
          이미 입력을 마쳤나요?{" "}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            워크스페이스 열기
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
