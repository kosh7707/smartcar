import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, X, XCircle } from "lucide-react";

type ToastType = "error" | "warning" | "success";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  error: (message: string, action?: ToastAction) => void;
  warning: (message: string, action?: ToastAction) => void;
  success: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  success: <CheckCircle size={16} />,
};

const AUTO_DISMISS_MS = 5000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const show = useCallback((type: ToastType, message: string, action?: ToastAction) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, action }]);
    const timer = setTimeout(() => { timers.current.delete(id); dismiss(id); }, AUTO_DISMISS_MS);
    timers.current.set(id, timer);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    error: (msg, action) => show("error", msg, action),
    warning: (msg, action) => show("warning", msg, action),
    success: (msg, action) => show("success", msg, action),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed right-6 bottom-6 z-[1000] flex w-max max-w-[560px] flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-3 rounded-md px-4 py-3 text-sm shadow-[var(--cds-shadow-dropdown)] backdrop-blur-[12px] animate-fade-in",
              t.type === "warning" && "border border-[var(--aegis-severity-medium-border)] bg-[color-mix(in_srgb,var(--cds-background)_92%,var(--aegis-severity-medium))] text-[var(--aegis-severity-medium)]",
              t.type === "error" && "border border-[var(--aegis-severity-critical-border)] bg-[color-mix(in_srgb,var(--cds-background)_92%,var(--cds-support-error))] text-[var(--aegis-severity-high)]",
              t.type === "success" && "border border-[var(--aegis-status-fixed-border)] bg-[color-mix(in_srgb,var(--cds-background)_92%,var(--cds-support-success))] text-[var(--cds-support-success)]",
            )}
            role="alert"
            aria-live="assertive"
          >
            {ICONS[t.type]}
            <span className="flex-1 leading-[1.4]">{t.message}</span>
            {t.action && (
              <button
                className="shrink-0 whitespace-nowrap rounded-sm border border-current px-2 py-0.5 text-[14px] font-medium opacity-80 transition-opacity hover:opacity-100"
                onClick={() => { dismiss(t.id); t.action!.onClick(); }}
              >
                {t.action.label}
              </button>
            )}
            <button
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              onClick={() => dismiss(t.id)}
              aria-label="알림 닫기"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
