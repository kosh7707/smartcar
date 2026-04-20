"use client"
import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) { return <SelectPrimitive.Root data-slot="select" {...props} /> }
function SelectGroup({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) { return <SelectPrimitive.Group data-slot="select-group" className={cn("ui-select-group", className)} {...props} /> }
function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) { return <SelectPrimitive.Value data-slot="select-value" {...props} /> }
function SelectTrigger({ className, size = "default", children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "default" }) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" data-size={size} className={cn("ui-select-trigger", className)} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDownIcon /></SelectPrimitive.Icon></SelectPrimitive.Trigger>
}
function SelectContent({ className, children, position = "item-aligned", align = "center", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content data-slot="select-content" className={cn("ui-select-content", className)} position={position} align={align} {...props}><SelectScrollUpButton /><SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport><SelectScrollDownButton /></SelectPrimitive.Content></SelectPrimitive.Portal>
}
function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) { return <SelectPrimitive.Label data-slot="select-label" className={cn("ui-select-label", className)} {...props} /> }
function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn("ui-select-item", className)} {...props}><span className="ui-select-indicator"><SelectPrimitive.ItemIndicator><CheckIcon /></SelectPrimitive.ItemIndicator></span><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>
}
function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) { return <SelectPrimitive.Separator data-slot="select-separator" className={cn("ui-select-separator", className)} {...props} /> }
function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) { return <SelectPrimitive.ScrollUpButton data-slot="select-scroll-up-button" className={cn("ui-select-scroll", className)} {...props}><ChevronUpIcon /></SelectPrimitive.ScrollUpButton> }
function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) { return <SelectPrimitive.ScrollDownButton data-slot="select-scroll-down-button" className={cn("ui-select-scroll", className)} {...props}><ChevronDownIcon /></SelectPrimitive.ScrollDownButton> }
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue }
