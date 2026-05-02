import React, { forwardRef, useId } from "react";
import { cn } from "@/common/utils/cn";
import "./InputField.css";

type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">;

export interface InputFieldProps extends NativeInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  fieldClassName?: string;
  type?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  {
    label,
    name,
    value,
    onChange,
    error,
    hint,
    required,
    disabled,
    className,
    fieldClassName,
    id: idOverride,
    type = "text",
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
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        className={cn("form-input", className)}
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
});
