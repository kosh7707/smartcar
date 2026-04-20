"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) { return <DialogPrimitive.Root data-slot="dialog" {...props} /> }
function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) { return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} /> }
function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) { return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} /> }
function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) { return <DialogPrimitive.Close data-slot="dialog-close" {...props} /> }
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay data-slot="dialog-overlay" className={cn("ui-dialog-overlay", className)} {...props} />
}
function DialogContent({ className, children, showCloseButton = true, overlayClassName, onOverlayClick, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean; overlayClassName?: string; onOverlayClick?: React.MouseEventHandler<HTMLDivElement> }) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} onClick={onOverlayClick} />
      <DialogPrimitive.Content data-slot="dialog-content" className={cn("ui-dialog-content", className)} {...props}>
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="ui-dialog-close" size="icon-sm"><XIcon /><span className="sr-only">Close</span></Button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="dialog-header" className={cn("ui-dialog-header", className)} {...props} /> }
function DialogFooter({ className, showCloseButton = false, children, ...props }: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  return <div data-slot="dialog-footer" className={cn("ui-dialog-footer", className)} {...props}>{children}{showCloseButton ? <DialogPrimitive.Close asChild><Button variant="outline">Close</Button></DialogPrimitive.Close> : null}</div>
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) { return <DialogPrimitive.Title data-slot="dialog-title" className={cn("ui-dialog-title", className)} {...props} /> }
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) { return <DialogPrimitive.Description data-slot="dialog-description" className={cn("ui-dialog-description", className)} {...props} /> }

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger }
