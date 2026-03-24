import React from "react";
import type { BuildTargetStatus } from "@aegis/shared";
import { Check, Loader, X } from "lucide-react";
import "./TargetProgressStepper.css";

const STEPS = [
  { key: "setup", label: "설정", statuses: ["discovered", "configured"] },
  { key: "build", label: "빌드", statuses: ["building", "built", "build_failed"] },
  { key: "scan", label: "스캔", statuses: ["scanning", "scanned", "scan_failed"] },
  { key: "graph", label: "그래프", statuses: ["graphing", "graphed", "graph_failed"] },
  { key: "ready", label: "완료", statuses: ["ready"] },
] as const;

// Map status to step index
function getStepIndex(status: string): number {
  for (let i = 0; i < STEPS.length; i++) {
    if ((STEPS[i].statuses as readonly string[]).includes(status)) return i;
  }
  return 0;
}

function isFailed(status: string): boolean {
  return status.endsWith("_failed");
}

function isRunning(status: string): boolean {
  return ["building", "scanning", "graphing"].includes(status);
}

interface Props {
  status: BuildTargetStatus | string;
  message?: string;
}

export const TargetProgressStepper: React.FC<Props> = ({ status, message }) => {
  const currentIdx = getStepIndex(status);
  const failed = isFailed(status);
  const running = isRunning(status);

  return (
    <div className="tps">
      <div className="tps__steps">
        {STEPS.map((step, i) => {
          const isComplete = i < currentIdx || (i === currentIdx && !failed && !running && status !== "discovered");
          const isCurrent = i === currentIdx;
          const isActive = isCurrent && running;
          const isFail = isCurrent && failed;

          let cls = "tps__step";
          if (isComplete) cls += " tps__step--done";
          else if (isActive) cls += " tps__step--active";
          else if (isFail) cls += " tps__step--failed";
          else if (isCurrent && status !== "discovered") cls += " tps__step--current";

          return (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <div className={`tps__connector${isComplete ? " tps__connector--done" : isCurrent && !failed ? " tps__connector--active" : ""}`} />
              )}
              <div className={cls} title={step.label}>
                <div className="tps__dot">
                  {isComplete && <Check size={10} />}
                  {isActive && <Loader size={10} className="animate-spin" />}
                  {isFail && <X size={10} />}
                </div>
                <span className="tps__label">{step.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {message && (
        <div className={`tps__message${failed ? " tps__message--error" : ""}`}>{message}</div>
      )}
    </div>
  );
};
