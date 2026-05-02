import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { getThemePreference, setThemePreference } from "@/common/utils/theme";

type AuthConsoleShellProps = {
  brandPanel: React.ReactNode;
  children: React.ReactNode;
  onBack?: { label: string; onClick: () => void };
};

type AuthConsoleBrandMarkProps = {
  tagline: string;
  region: string;
  statusLabel: string;
};

type AuthConsoleFooterItem = { type: "text" | "link"; label: string; href?: string };

type AuthConsoleFooterMetaProps = {
  items: AuthConsoleFooterItem[];
};

function isDarkTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function AuthConsoleShell({ brandPanel, children, onBack }: AuthConsoleShellProps) {
  const [darkTheme, setDarkTheme] = useState(() => isDarkTheme());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDarkTheme(isDarkTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const themeLabel = useMemo(() => {
    const pref = getThemePreference();
    if (pref === "system") return darkTheme ? "시스템(다크)" : "시스템(라이트)";
    return darkTheme ? "다크" : "라이트";
  }, [darkTheme]);

  const handleThemeToggle = () => {
    setThemePreference(darkTheme ? "light" : "dark");
    setDarkTheme((cur) => !cur);
  };

  return (
    <div className="shell">
      {brandPanel}
      <section className="form-panel" data-chore>
        {onBack ? (
          <button
            className="theme-toggle theme-toggle--back-offset chore c-1"
            type="button"
            onClick={onBack.onClick}
            aria-label={onBack.label}
            title={onBack.label}
          >
            <ArrowLeft />
          </button>
        ) : null}
        <button
          className="theme-toggle chore c-1"
          type="button"
          onClick={handleThemeToggle}
          aria-label={`테마 전환 (현재: ${themeLabel})`}
          title={`테마 전환 (현재: ${themeLabel})`}
        >
          {darkTheme ? <Sun className="sun" /> : <Moon className="moon" />}
        </button>
        {children}
      </section>
    </div>
  );
}

export function AuthConsoleBrandMark({ tagline, region, statusLabel }: AuthConsoleBrandMarkProps) {
  return (
    <header className="brand-mark chore c-1">
      <div className="row-1">
        <div className="shield" aria-hidden="true">
          <svg viewBox="0 0 44 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 1 L42 6 V24 C42 36 33 44 22 47 C11 44 2 36 2 24 V6 Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill="oklch(1 0 0 / 0.015)"/><path d="M22 11 L30 15.5 V24.5 L22 29 L14 24.5 V15.5 Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" opacity="0.45"/></svg>
          <span className="dot"></span>
        </div>
        <div className="wordstack">
          <div className="wordmark">AEGIS</div>
          <div className="tagline">{tagline}</div>
        </div>
      </div>

      <div className="spec">
        <div className="cell"><span className="k">region</span><span className="v">{region}</span></div>
        <div className="cell"><span className="k">status</span><span className="v"><span className="live-dot"></span>{statusLabel}</span></div>
      </div>
    </header>
  );
}

export const AUTH_CONSOLE_STATUS_ROWS: { key: string; value: string }[] = [
  { key: "API", value: "api.aegis.local · v0.1.0" },
  { key: "Orchestrator", value: "connected · 3 agents live" },
  { key: "Analyzers", value: "SAST · Dynamic · Test queue idle" },
];

export function AuthConsoleFooterMeta({ items }: AuthConsoleFooterMetaProps) {
  return (
    <footer className="brand-meta chore c-5">
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {item.type === "link" ? (
            <a href={item.href ?? "#"} onClick={(event) => event.preventDefault()}>{item.label}</a>
          ) : (
            <span>{item.label}</span>
          )}
          {index < items.length - 1 ? <span className="vdiv"></span> : null}
        </React.Fragment>
      ))}
    </footer>
  );
}
