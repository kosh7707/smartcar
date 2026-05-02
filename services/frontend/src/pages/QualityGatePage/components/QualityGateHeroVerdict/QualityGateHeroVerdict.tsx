import "./QualityGateHeroVerdict.css";
import React from "react";
import { ShieldCheck, ShieldOff, ShieldX, AlertTriangle, GitCommitHorizontal, User } from "lucide-react";
import { OutcomeChip } from "@/common/ui/primitives/OutcomeChip";
import type { GateResult } from "@/common/api/gate";
import { formatDateTime } from "@/common/utils/format";
import {
  STATUS_CONFIG,
  buildHeroHeadline,
  buildHeroSubLine,
  formatRequestedBy,
  readQualityOutcome,
} from "../../qualityGatePresentation";

// Severity on icon/bar/lab is gate-context P3 exception (handoff §2.2).
function statusIcon(mod: "blocked" | "warn" | "pass" | "running") {
  if (mod === "blocked") return <ShieldX aria-hidden="true" />;
  if (mod === "warn") return <ShieldOff aria-hidden="true" />;
  if (mod === "pass") return <ShieldCheck aria-hidden="true" />;
  return <AlertTriangle aria-hidden="true" />;
}

// Hero-verdict BEM modifier names diverge from the canonical .gate / .cell-gate
// vocabulary so the page CSS does not collide with the drift-token lint
// (--pass / --warn / --fail are forbidden CSS-variable names from the mock).
// The canonical .cell-gate / .gate modifier still uses gateMod directly.
const HERO_MOD: Record<"blocked" | "warn" | "pass" | "running", string> = {
  blocked: "blocked",
  warn: "caution",
  pass: "ok",
  running: "running",
};

export function QualityGateHeroVerdict({ gate }: { gate: GateResult }) {
  const config = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.warning;
  const headline = buildHeroHeadline(gate.status);
  const subLine = buildHeroSubLine(gate);
  const qualityOutcome = readQualityOutcome(gate);
  const requestedByLabel = formatRequestedBy(gate.requestedBy ?? undefined);

  return (
    <section
      className={`hero-verdict hero-verdict--compact hero-verdict--${HERO_MOD[config.gateMod]}`}
      aria-label="최신 품질 게이트 판정"
    >
      <div className="hero-verdict__bar" aria-hidden="true" />
      <div className="hero-verdict__main">
        <div className="hero-verdict__eyebrow">
          <span className="hero-verdict__eyebrow-text">최신 평가 · Run #{gate.runId}</span>
          {qualityOutcome ? (
            <OutcomeChip kind="quality" value={qualityOutcome} size="sm" />
          ) : null}
        </div>
        <div className="hero-verdict__big">
          <div className="hero-verdict__icon" aria-hidden="true">
            {statusIcon(config.gateMod)}
          </div>
          <div className="hero-verdict__label">
            <span className="hero-verdict__title">{config.label}</span>
            <span className="hero-verdict__sub">{subLine}</span>
          </div>
        </div>
        <h2 className="hero-verdict__headline">{headline}</h2>
      </div>
      <div className="hero-verdict__detail">
        <div className="hero-verdict__detail-row">
          <GitCommitHorizontal aria-hidden="true" />
          <span>
            commit{" "}
            <b>{gate.commit ? gate.commit.slice(0, 7) : <span className="hero-verdict__placeholder">—</span>}</b>
            {" · "}branch{" "}
            <b>{gate.branch ?? <span className="hero-verdict__placeholder">—</span>}</b>
          </span>
        </div>
        <div className="hero-verdict__detail-row">
          <User aria-hidden="true" />
          <span>
            <b>{requestedByLabel ?? <span className="hero-verdict__placeholder">—</span>}</b>
            {" · "}
            {formatDateTime(gate.evaluatedAt)}
          </span>
        </div>
      </div>
    </section>
  );
}
