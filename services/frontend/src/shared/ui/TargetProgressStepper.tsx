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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const isComplete = i < currentIdx || (i === currentIdx && !failed && !running && status !== "discovered");
          const isCurrent = i === currentIdx;
          const isActive = isCurrent && running;
          const isFail = isCurrent && failed;

          return (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <div
                  className={cn(
                    "mb-3.5 mx-0.5 h-0.5 min-w-4 max-w-10 flex-1 bg-border transition-colors",
                    isComplete && "bg-[var(--cds-support-success)]",
                    isCurrent && !failed && "bg-primary/50",
                  )}
                />
              )}
              <div className="flex shrink-0 flex-col items-center gap-0.5" title={step.label}>
                <div
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border-2 border-border bg-background text-muted-foreground transition-colors",
                    isComplete && "border-[var(--cds-support-success)] bg-[var(--cds-support-success)] text-white",
                    isActive && "border-[var(--aegis-severity-medium)] bg-[color-mix(in_srgb,var(--aegis-severity-medium)_15%,transparent)] text-[var(--aegis-severity-medium)]",
                    isFail && "border-[var(--aegis-severity-high)] bg-[var(--aegis-severity-high)] text-white",
                    isCurrent && !isActive && !isFail && status !== "discovered" && "border-primary bg-primary/10 text-primary",
                  )}
                >
                  {isComplete && <Check size={10} />}
                  {isActive && <Loader size={10} className="animate-spin" />}
                  {isFail && <X size={10} />}
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap text-sm font-medium text-muted-foreground",
                    isComplete && "text-[var(--cds-support-success)]",
                    isActive && "font-semibold text-[var(--aegis-severity-medium)]",
                    isFail && "font-semibold text-[var(--aegis-severity-high)]",
                    isCurrent && !isActive && !isFail && status !== "discovered" && "text-primary",
                  )}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {message && (
        <div className={cn("pl-0.5 text-xs text-muted-foreground", failed && "text-[var(--aegis-severity-high)]")}>{message}</div>
      )}
    </div>
  );
};
