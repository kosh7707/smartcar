import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="input-group" role="group" className={cn("ui-input-group", className)} {...props} /> }
function InputGroupAddon({ className, align = "inline-start", ...props }: React.ComponentProps<"div"> & { align?: "inline-start" | "inline-end" | "block-start" | "block-end" }) {
  return <div role="group" data-slot="input-group-addon" data-align={align} className={cn("ui-input-group-addon", className)} {...props} />
}
function InputGroupButton({ className, type = "button", variant = "ghost", size = "xs", ...props }: Omit<React.ComponentProps<typeof Button>, "size"> & { size?: "xs" | "sm" | "icon-xs" | "icon-sm" }) {
  return <Button type={type} variant={variant} size={size === "sm" ? "sm" : size === "icon-sm" ? "icon-sm" : size === "icon-xs" ? "icon-xs" : "xs"} className={cn("ui-input-group-button", className)} {...props} />
}
function InputGroupText({ className, ...props }: React.ComponentProps<"span">) { return <span className={cn("ui-input-group-text", className)} {...props} /> }
function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) { return <Input data-slot="input-group-control" className={cn("ui-input-group-input", className)} {...props} /> }
function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) { return <Textarea data-slot="input-group-control" className={cn("ui-input-group-textarea", className)} {...props} /> }
export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea }
