import React, { forwardRef, useId } from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import "./SelectField.css";

export interface SelectFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  fieldClassName?: string;
  id?: string;
}

export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps>(function SelectField(
  {
    label,
    name,
    value,
    onValueChange,
    options,
    placeholder,
    error,
    hint,
    required,
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
      className={cn("form-field", fieldClassName)}
      data-invalid={error ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
    >
      <label htmlFor={id} className={cn("form-label", required && "form-label--required")}>
        {label}
      </label>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          className={cn("form-select-trigger", className)}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown size={14} aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content position="popper" className="form-select-content">
            <SelectPrimitive.Viewport>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="form-select-item"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="form-select-indicator">
                    <Check size={14} aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
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
});
