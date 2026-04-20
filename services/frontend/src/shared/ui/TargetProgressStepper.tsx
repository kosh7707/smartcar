import React from "react";
import type { BuildTargetStatus } from "@aegis/shared";
import { Check, Loader, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "setup", label: "설정", statuses: ["discovered", "configured"] },
  { key: "build", label: "빌드", statuses: ["building", "built", "build_failed"] },
  { key: "scan", label: "스캔", statuses: ["scanning", "scanned", "scan_failed"] },
  { key: "graph", label: "그래프", statuses: ["graphing", "graphed", "graph_failed"] },
  { key: "ready", label: "완료", statuses: ["ready"] },
] as const;

function getStepIndex(status: string): number {
  for (let index = 0; index < STEPS.length; index++) {
    if ((STEPS[index].statuses as readonly string[]).includes(status)) return index;
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
    <div className="target-progress-stepper">
      <div className="target-progress-stepper__track">
        {STEPS.map((step, index) => {
          const isComplete = index < currentIdx || (index === currentIdx && !failed && !running && status !== "discovered");
          const isCurrent = index === currentIdx;
          const isActive = isCurrent && running;
          const isFail = isCurrent && failed;

          return (
            <React.Fragment key={step.key}>
              {index > 0 ? (
                <div
                  className={cn(
                    "target-progress-stepper__connector",
                    isComplete && "is-complete",
                    isCurrent && !failed && "is-current",
                  )}
                />
              ) : null}
              <div className="target-progress-stepper__step" title={step.label}>
                <div
                  className={cn(
                    "target-progress-stepper__marker",
                    isComplete && "is-complete",
                    isActive && "is-active",
                    isFail && "is-fail",
                    isCurrent && !isActive && !isFail && status !== "discovered" && "is-current",
                  )}
                >
                  {isComplete ? <Check size={10} /> : null}
                  {isActive ? <Loader size={10} className="target-progress-stepper__spin" /> : null}
                  {isFail ? <X size={10} /> : null}
                </div>
                <span
                  className={cn(
                    "target-progress-stepper__label",
                    isComplete && "is-complete",
                    isActive && "is-active",
                    isFail && "is-fail",
                    isCurrent && !isActive && !isFail && status !== "discovered" && "is-current",
                  )}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {message ? (
        <div className={cn("target-progress-stepper__message", failed && "is-fail")}>{message}</div>
      ) : null}
    </div>
  );
};
