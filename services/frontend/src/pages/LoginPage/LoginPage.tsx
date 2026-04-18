import React from "react";
import { ShieldCheck, Workflow, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "../../contexts/AuthContext";
import { LoginFormCard } from "./components/LoginFormCard";
import { useLoginForm } from "./hooks/useLoginForm";

const workflowSignals = [
  "정적 · 동적 분석",
  "Quality Gate & Approval",
  "Firmware Security Trace",
];

const operatorChecks = [
  {
    icon: Workflow,
    label: "진입 후 복원",
    detail: "최근 프로젝트, 승인 대기, 게이트 컨텍스트를 같은 세션 리듬으로 이어갑니다.",
  },
  {
    icon: ShieldCheck,
    label: "검토 상태 유지",
    detail: "품질 게이트와 보안 검토 흐름이 워크스페이스 단위로 정렬됩니다.",
  },
  {
    icon: Zap,
    label: "즉시 작업 전환",
    detail: "로그인 직후 대시보드로 이동해 분석 작업을 계속할 수 있습니다.",
  },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const {
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    handleSubmit,
  } = useLoginForm(login, navigate);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.9)_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-border/70 bg-background/96 shadow-[0_32px_96px_-40px_rgba(15,23,42,0.55)] backdrop-blur lg:grid-cols-[minmax(0,1.15fr)_440px]">
          <section
            className="flex flex-col justify-between gap-8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_32%),linear-gradient(160deg,#09111d_0%,#0f172a_52%,#111827_100%)] px-6 py-8 text-white sm:px-8 sm:py-10 lg:px-10 lg:py-12"
            aria-label="AEGIS introduction"
          >
            <div className="space-y-6">
              <Badge variant="secondary" className="w-fit border border-white/10 bg-white/10 px-3 py-1 text-[0.7rem] tracking-[0.18em] text-white uppercase hover:bg-white/10">
                AEGIS operator console
              </Badge>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.08em] text-white sm:text-5xl lg:text-6xl">
                  AEGIS
                </h1>
                <p className="max-w-xl text-lg text-white/86 sm:text-xl">
                  임베디드 펌웨어 보안 운영 콘솔
                </p>
                <p className="max-w-xl text-base leading-7 text-white/74">
                  임베디드 펌웨어 보안 분석 작업을 이어갑니다.
                </p>
                <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                  분석 실행, 승인 대기, 게이트 상태를 같은 작업 리듬 안에서 이어갈 수 있도록 설계된 운영형 워크스페이스입니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-2" aria-label="AEGIS workflow signals">
                {workflowSignals.map((signal) => (
                  <Badge
                    key={signal}
                    variant="outline"
                    className="border-white/12 bg-white/5 px-3 py-1 text-xs text-white/78 backdrop-blur hover:bg-white/10"
                  >
                    {signal}
                  </Badge>
                ))}
              </div>
            </div>

            <Card className="border-white/10 bg-white/6 py-0 text-white shadow-none backdrop-blur">
              <CardContent className="grid gap-4 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-3">
                {operatorChecks.map(({ icon: Icon, label, detail }) => (
                  <div key={label} className="space-y-3 rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Icon className="size-4 text-cyan-200" aria-hidden="true" />
                      <span>{label}</span>
                    </div>
                    <p className="text-sm leading-6 text-white/62">{detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col justify-center gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <LoginFormCard
              username={username}
              password={password}
              error={error}
              submitting={submitting}
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onSubmit={handleSubmit}
            />

            <div className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                <span>운영자 세션 메모</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                로그인 후에는 최근 분석 컨텍스트와 검토 흐름이 대시보드에서 즉시 이어집니다.
              </p>
              <Separator className="my-4" />
              <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">
                AEGIS v{__APP_VERSION__} — Embedded Firmware Security Analysis Platform
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
