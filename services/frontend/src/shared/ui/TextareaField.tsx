import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import "./TextareaField.css";

type NativeTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange">;

export interface TextareaFieldProps extends NativeTextareaProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string, event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  rows?: number;
  className?: string;
  fieldClassName?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
    {
      label,
      name,
      value,
      onChange,
      error,
      hint,
      required,
      disabled,
      rows = 4,
      className,
      fieldClassName,
      id: idOverride,
      ...rest
    },
    ref,
  ) {
    const auto = useId();
    const id = idOverride ?? `${name}-${auto}`;
    const hintId = hint ? `${id}-hint` : undefined;
    const errId = error ? `${id}-err` : undefined;
    return (
      <div
        className={cn("form-field", fieldClassName)}
        data-invalid={error ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
      >
        <label htmlFor={id} className={cn("form-label", required && "form-label--required")}>
          {label}
        </label>
        <textarea
          ref={ref}
          id={id}
          name={name}
          rows={rows}
          value={value}
          required={required}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          className={cn("form-textarea", className)}
          onChange={(event) => onChange(event.target.value, event)}
          {...rest}
        />
        {hint && !error && (
          <span id={hintId} className="form-hint">
            {hint}
          </span>
        )}
        {error && (
          <span id={errId} className="form-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);
