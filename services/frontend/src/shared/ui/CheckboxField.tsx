import React, { forwardRef, useId } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import "./CheckboxField.css";

export interface CheckboxFieldProps {
  label: string;
  name: string;
  checked: boolean;
  onCheckedChange: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  fieldClassName?: string;
  id?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField(
    {
      label,
      name,
      checked,
      onCheckedChange,
      error,
      hint,
      disabled,
      className,
      fieldClassName,
      id: idOverride,
    },
    ref,
  ) {
    const auto = useId();
    const id = idOverride ?? `${name}-${auto}`;
    const hintId = hint ? `${id}-hint` : undefined;
    const errId = error ? `${id}-err` : undefined;
    return (
      <div
        className={cn("form-field form-field--inline", fieldClassName)}
        data-invalid={error ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
      >
        <span className={cn("form-checkbox", className)}>
          <input
            ref={ref}
            id={id}
            name={name}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
            className="form-checkbox__input"
            onChange={(event) => onCheckedChange(event.target.checked, event)}
          />
          <span className="form-checkbox__mark" aria-hidden="true">
            <Check size={12} />
          </span>
        </span>
        <label htmlFor={id} className="form-checkbox__label">
          <span>{label}</span>
          {hint && !error && (
            <span id={hintId} className="form-hint form-checkbox__hint">
              {hint}
            </span>
          )}
          {error && (
            <span id={errId} className="form-error" role="alert">
              {error}
            </span>
          )}
        </label>
      </div>
    );
  },
);
