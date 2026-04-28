import React from "react";
import { cn } from "@/lib/utils";
import "./PageHeader.css";

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  leading?: React.ReactNode;
  /**
   * `plain` (default) — flush page-head, used by every project page so the h1
   * sits at the canonical 28px / semibold / -0.02em scale.
   * `card` is retained as an opt-in escape hatch but is no longer used.
   */
  surface?: "card" | "plain";
}

export const PageHeader: React.FC<Props> = ({ title, subtitle, action, leading, surface = "plain" }) => {
  const body = (
    <>
      <div className="page-header__left">
        {leading ? <div className="page-header__leading">{leading}</div> : null}
        <div className="page-header__text">
          <h1 className="page-header__title">{title}</h1>
          {subtitle ? <div className="page-header__subtitle">{subtitle}</div> : null}
        </div>
      </div>
      {action ? <div className="page-header__action actions">{action}</div> : null}
    </>
  );

  if (surface === "card") {
    return (
      <section className={cn("page-header page-header--card surface-panel")}>
        <div className="surface-panel-body">
          <header className="page-head">{body}</header>
        </div>
      </section>
    );
  }

  return <header className={cn("page-header page-header--plain page-head")}>{body}</header>;
};
