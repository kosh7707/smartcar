import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import { cn } from "@/common/utils/cn";
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
      <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "toast",
              `toast--${t.type}`,
            )}
            role="alert"
            aria-live="assertive"
          >
            <span className="toast__icon" aria-hidden="true">{ICONS[t.type]}</span>
            <span className="toast__message">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => { dismiss(t.id); t.action!.onClick(); }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast__close"
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
