"use client"
import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("ui-radio-group", className)} {...props} />
}
function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return <RadioGroupPrimitive.Item data-slot="radio-group-item" className={cn("ui-radio-item", className)} {...props}><RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" className="ui-radio-indicator"><span className="ui-radio-dot" /></RadioGroupPrimitive.Indicator></RadioGroupPrimitive.Item>
}
export { RadioGroup, RadioGroupItem }
