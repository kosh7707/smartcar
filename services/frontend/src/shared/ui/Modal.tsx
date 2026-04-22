import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
  overlayClassName?: string;
  children: React.ReactNode;
  initialFocusSelector?: string;
  dismissOnOverlayClick?: boolean;
  dismissOnEscape?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  labelledBy,
  describedBy,
  className,
  overlayClassName,
  children,
  initialFocusSelector = "textarea, input, button",
  dismissOnOverlayClick = true,
  dismissOnEscape = true,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const el = contentRef.current?.querySelector<HTMLElement>(initialFocusSelector);
    el?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissOnEscape) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = contentRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, dismissOnEscape, initialFocusSelector, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn("modal-overlay", overlayClassName)}
      onClick={(event) => {
        if (dismissOnOverlayClick && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn("modal-content", className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};
