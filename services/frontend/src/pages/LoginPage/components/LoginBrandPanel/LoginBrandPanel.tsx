import "./LoginBrandPanel.css";
import React from "react";
import { AUTH_CONSOLE_STATUS_ROWS, AuthConsoleBrandMark, AuthConsoleFooterMeta } from "@/common/ui/auth/AuthConsoleShell";
import { LoginBrandHero } from "../LoginBrandHero/LoginBrandHero";

export const LoginBrandPanel: React.FC = () => (
  <aside className="brand-panel" data-chore>
    <AuthConsoleBrandMark tagline="embedded security · analysis platform" region="kr-seoul-1" statusLabel="operational" />

    <LoginBrandHero statusRows={AUTH_CONSOLE_STATUS_ROWS} />

    <AuthConsoleFooterMeta items={[
      { type: "text", label: "© 2026 AEGIS" },
      { type: "link", label: "status" },
      { type: "link", label: "docs" },
      { type: "text", label: `v${__APP_VERSION__} · main` },
    ]} />
  </aside>
);
