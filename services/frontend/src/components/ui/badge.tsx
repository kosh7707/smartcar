import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

type Variant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"

function badgeClass(variant: Variant) {
  switch (variant) {
    case "destructive": return "sev-chip critical"
    case "secondary": return "pill"
    case "outline": return "pill"
    case "ghost": return "pill"
    case "link": return "pill"
    default: return "pill active"
  }
}

function Badge({ className, variant = "default", asChild = false, ...props }: React.ComponentProps<"span"> & { variant?: Variant; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return <Comp data-slot="badge" className={cn(badgeClass(variant), className)} {...props} />
}

export { Badge }
