import * as React from "react"
import { cn } from "@/lib/utils"

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & { variant?: "default" | "destructive" }) {
  return <div data-slot="alert" role="alert" className={cn("ui-alert", variant === "destructive" && "ui-alert--destructive", className)} {...props} />
}
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="alert-title" className={cn("ui-alert-title", className)} {...props} /> }
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="alert-description" className={cn("ui-alert-description", className)} {...props} /> }
function AlertAction({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="alert-action" className={cn("ui-alert-action", className)} {...props} /> }
export { Alert, AlertTitle, AlertDescription, AlertAction }
