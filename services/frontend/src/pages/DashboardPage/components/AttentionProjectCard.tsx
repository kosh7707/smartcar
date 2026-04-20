import React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardProject } from "../dashboardTypes";
import {
  latestProjectTimestamp,
  projectDisplayWhen,
  projectIsRunning,
  projectLanguage,
  projectMetaLabel,
  projectPendingApprovals,
  totalFindings,
  unresolvedFindings,
} from "../dashboardProjectSignals";

interface AttentionProjectCardProps { project: DashboardProject; }

function gateTone(gateStatus?: string | null): "blocked" | "warn" | null {
  if (gateStatus === "running") return "warn";
  if (gateStatus === "fail") return "blocked";
  if (gateStatus === "warning") return "warn";
  return null;
}

function buildProjectChips(project: DashboardProject) {
  const chips: Array<{ label: string; tone: "critical" | "high" | "medium" | "low" }> = [];
  const summary = project.severitySummary;
  if ((summary?.critical ?? 0) > 0) chips.push({ label: String(summary?.critical ?? 0), tone: "critical" });
  if ((summary?.high ?? 0) > 0) chips.push({ label: String(summary?.high ?? 0), tone: "high" });
  if ((summary?.medium ?? 0) > 0) chips.push({ label: String(summary?.medium ?? 0), tone: "medium" });
  if ((summary?.low ?? 0) > 0) chips.push({ label: String(summary?.low ?? 0), tone: "low" });
  return chips;
}

export const AttentionProjectCard: React.FC<AttentionProjectCardProps> = ({ project }) => {
  const gate = gateTone(project.gateStatus);
  const total = totalFindings(project);
  const approvals = projectPendingApprovals(project);
  const isRunning = projectIsRunning(project);
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const chips = buildProjectChips(project);
  const unresolved = unresolvedFindings(project);
  const lang = projectLanguage(project);
  const footLabel = isRunning
    ? "ETA ~4분"
    : latestProjectTimestamp(project)
      ? `${projectDisplayWhen(project)} 완료`
      : projectDisplayWhen(project);

  let headline: React.ReactNode = <>탐지 항목 {total}건 · 미해결 {unresolved}건 · 최근 업데이트</>;
  if (isRunning) {
    headline = <>Static 분석 <span className="n">64%</span> · Agent · <span className="mono">taint-flow heuristic</span></>;
  } else if (critical > 0 || high > 0) {
    headline = (
      <>
        <span className="n critical">{critical}</span> critical, <span className="n high">{high}</span> high 신규 — 마지막 스캔에서 <span className="n critical">+{Math.max(1, unresolved || critical || high)}</span> 증가
      </>
    );
  } else if (project.gateStatus === "warning") {
    headline = <>Quality Gate 2개 룰 실패 · <span className="n high">{high}</span> high, 품질 게이트 재평가 필요</>;
  }

  return (
    <Link to={`/projects/${project.id}/overview`} className="att-card-link">
      <article className={`att-card sev-${critical > 0 ? 'critical' : high > 0 ? 'high' : 'medium'}`}>
        <div className="att-head">
          <div className="title-block">
            <div className="title"><span className="dot-sev"></span>{project.name}</div>
            <div className="meta">
              <span className={`lang-tag l-${lang === "cpp" ? "cpp" : lang === "rust" ? "rust" : lang === "ts" ? "ts" : lang === "py" ? "py" : "c"}`}><span className="lang-dot"></span>{lang}</span>
              <span className="sep">·</span>
              <span>{projectMetaLabel(project)}</span>
            </div>
          </div>
          {isRunning ? <span className="gate running">RUNNING</span> : gate ? <span className={`gate ${gate}`}>{gate === 'blocked' ? 'BLOCKED' : 'REVIEW'}</span> : <span className="gate pass">PASS</span>}
        </div>
        {isRunning ? <div className="att-progress" title="분석 진행 중"></div> : null}
        <div className="att-body">
          <div className="att-headline">{headline}</div>
          {chips.length > 0 ? <div className="att-chips">{chips.map((chip) => <span key={`${project.id}-${chip.tone}`} className={`chip-sev ${chip.tone}`}>{chip.label}</span>)}</div> : null}
        </div>
        <div className="att-foot">
          <div className="left">
            <span>{footLabel}</span>
            <span className="sep">·</span>
            <span>승인 {approvals}건 대기</span>
          </div>
          <ArrowRight className="arrow" size={14} aria-hidden="true" />
        </div>
      </article>
    </Link>
  );
};
