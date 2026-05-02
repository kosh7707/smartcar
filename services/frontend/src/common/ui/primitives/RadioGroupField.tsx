import React, { forwardRef, useId } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/common/utils/cn";
import "./RadioGroupField.css";

export interface RadioGroupFieldOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface RadioGroupFieldProps {
  label: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: RadioGroupFieldOption[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  fieldClassName?: string;
  orientation?: "horizontal" | "vertical";
}

export const RadioGroupField = forwardRef<HTMLDivElement, RadioGroupFieldProps>(
  function RadioGroupField(
    {
      label,
      name,
      value,
      onValueChange,
      options,
      error,
      required,
      disabled,
      className,
      fieldClassName,
      orientation = "vertical",
    },
    ref,
  ) {
    const auto = useId();
    const groupId = `${name}-${auto}`;
    const errId = error ? `${groupId}-err` : undefined;
    return (
      <div
        className={cn("form-field", fieldClassName)}
        data-invalid={error ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
      >
        <span
          id={groupId}
          className={cn("form-label", required && "form-label--required")}
        >
          {label}
        </span>
        <RadioGroupPrimitive.Root
          ref={ref}
          value={value}
          onValueChange={onValueChange}
          name={name}
          disabled={disabled}
          orientation={orientation}
          aria-labelledby={groupId}
          aria-describedby={errId}
          aria-invalid={error ? "true" : undefined}
          className={cn("form-radio-group", `form-radio-group--${orientation}`, className)}
        >
          {options.map((option) => {
            const itemId = `${groupId}-${option.value}`;
            const hintId = option.hint ? `${itemId}-hint` : undefined;
            return (
              <label key={option.value} htmlFor={itemId} className="form-radio-option">
                <RadioGroupPrimitive.Item
                  id={itemId}
                  value={option.value}
                  disabled={option.disabled}
                  aria-describedby={hintId}
                  className="form-radio"
                >
                  <RadioGroupPrimitive.Indicator className="form-radio__indicator" />
                </RadioGroupPrimitive.Item>
                <span className="form-radio-option__text">
                  <span>{option.label}</span>
                  {option.hint && (
                    <span id={hintId} className="form-hint">
                      {option.hint}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </RadioGroupPrimitive.Root>
        {error && (
          <span id={errId} className="form-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);
