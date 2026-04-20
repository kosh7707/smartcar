import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
type Size = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"

function mapVariant(variant: Variant) {
  switch (variant) {
    case "outline": return "btn btn-outline"
    case "secondary": return "btn btn-ghost"
    case "ghost": return "btn btn-ghost"
    case "destructive": return "btn btn-danger"
    case "link": return "btn btn-link"
    default: return "btn btn-primary"
  }
}

function mapSize(size: Size) {
  switch (size) {
    case "xs": return "btn-sm"
    case "sm": return "btn-sm"
    case "lg": return "btn-lg"
    case "icon": return "btn-icon"
    case "icon-xs": return "btn-icon btn-sm"
    case "icon-sm": return "btn-icon btn-sm"
    case "icon-lg": return "btn-icon btn-lg"
    default: return ""
  }
}

function Button({ className, variant = "default", size = "default", asChild = false, ...props }: React.ComponentProps<"button"> & { variant?: Variant; size?: Size; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp data-slot="button" className={cn(mapVariant(variant), mapSize(size), className)} {...props} />
}

export { Button }
