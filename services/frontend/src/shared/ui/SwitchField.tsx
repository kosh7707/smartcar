import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import "./SwitchField.css";

export interface SwitchFieldProps {
  label: string;
  name: string;
  checked: boolean;
  onCheckedChange: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
  disabled?: boolean;
  className?: string;
  fieldClassName?: string;
  id?: string;
}

export const SwitchField = forwardRef<HTMLInputElement, SwitchFieldProps>(function SwitchField(
  {
    label,
    name,
    checked,
    onCheckedChange,
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
  return (
    <div
      className={cn("form-field form-field--inline", fieldClassName)}
      data-disabled={disabled ? "true" : undefined}
    >
      <span className={cn("form-switch", className)}>
        <input
          ref={ref}
          id={id}
          name={name}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-checked={checked}
          aria-describedby={hintId}
          className="form-switch__input"
          onChange={(event) => onCheckedChange(event.target.checked, event)}
        />
        <span className="form-switch__track" aria-hidden="true">
          <span className="form-switch__thumb" />
        </span>
      </span>
      <label htmlFor={id} className="form-switch__label">
        <span>{label}</span>
        {hint && (
          <span id={hintId} className="form-hint">
            {hint}
          </span>
        )}
      </label>
    </div>
  );
});
