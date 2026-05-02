import "./SignupBrandPanel.css";
import React from "react";
import { AuthConsoleBrandMark, AuthConsoleFooterMeta } from "@/common/ui/auth/AuthConsoleShell";
import { SignupBrandHero } from "../SignupBrandHero/SignupBrandHero";

const ONBOARDING_STEPS = [
  { label: "가입 요청 제출", detail: "이메일, 비밀번호, 조직 코드를 오른쪽 폼에 입력하세요.", current: true },
  { label: "조직 관리자 검토 · 승인", detail: "요청은 승인 큐에 등록됩니다. 평균 응답 시간 < 24h." },
  { label: "가입 시 입력한 계정으로 로그인", detail: "승인 즉시 최초 로그인 가능. 별도 초대 링크는 없습니다." },
  { label: "콘솔 진입 · 프로젝트 배정", detail: "배정된 프로젝트와 권한 스코프가 대시보드에 나타납니다." },
];

export const SignupBrandPanel: React.FC = () => (
  <aside className="brand-panel" data-chore>
    <AuthConsoleBrandMark tagline="embedded security · analysis platform" region="kr-seoul-1" statusLabel="operational" />

    <SignupBrandHero steps={ONBOARDING_STEPS} />

    <AuthConsoleFooterMeta items={[
      { type: "text", label: "© 2026 AEGIS" },
      { type: "link", label: "security" },
      { type: "link", label: "privacy" },
      { type: "text", label: `v${__APP_VERSION__} · main` },
    ]} />
  </aside>
);
