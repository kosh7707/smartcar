import React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

type TriggerProps = React.ComponentProps<typeof SelectPrimitive.Trigger>;

export const SelectTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(function SelectTrigger(
  { className, children, ...props },
  ref,
) {
  return (
    <SelectPrimitive.Trigger ref={ref} className={cn("form-select-trigger", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown size={14} aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

type ContentProps = React.ComponentProps<typeof SelectPrimitive.Content>;

export const SelectContent = React.forwardRef<HTMLDivElement, ContentProps>(function SelectContent(
  { className, children, position = "popper", ...props },
  ref,
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn("form-select-content", className)}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

type ItemProps = React.ComponentProps<typeof SelectPrimitive.Item>;

export const SelectItem = React.forwardRef<HTMLDivElement, ItemProps>(function SelectItem(
  { className, children, ...props },
  ref,
) {
  return (
    <SelectPrimitive.Item ref={ref} className={cn("form-select-item", className)} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="form-select-indicator">
        <Check size={14} aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
});

export const SelectSeparator: React.FC<React.ComponentProps<typeof SelectPrimitive.Separator>> = ({
  className,
  ...props
}) => <SelectPrimitive.Separator className={cn("form-select-separator", className)} {...props} />;

export const SelectLabel: React.FC<React.ComponentProps<typeof SelectPrimitive.Label>> = ({
  className,
  ...props
}) => <SelectPrimitive.Label className={cn("form-select-label", className)} {...props} />;
