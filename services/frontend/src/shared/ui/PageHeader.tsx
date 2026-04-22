import React from "react";
import { cn } from "@/lib/utils";
import "./PageHeader.css";

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  surface?: "card" | "plain";
}

export const PageHeader: React.FC<Props> = ({ title, subtitle, action, surface = "card" }) => {
  const headerClass =
    surface === "plain"
      ? "page-header page-header--plain page-head"
      : "page-header page-header--card surface-panel";

  const body = (
    <>
      <div className="page-header__left">
        <div className="page-header__text">
          <h1 className="page-header__title">{title}</h1>
          {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="page-header__action actions">{action}</div> : null}
    </>
  );

  if (surface === "plain") {
    return <header className={cn(headerClass)}>{body}</header>;
  }

  return (
    <section className={cn(headerClass)}>
      <div className="surface-panel-body">
        <header className="page-head">{body}</header>
      </div>
    </section>
  );
};
