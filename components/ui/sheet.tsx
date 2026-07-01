import { Drawer } from "@base-ui/react/drawer"
import { X } from "lucide-react"
import type * as React from "react"

import { cn } from "@/lib/utils"

type SheetSide = "top" | "right" | "bottom" | "left"

const sheetSideClasses: Record<SheetSide, string> = {
  top: "inset-x-0 top-0 max-h-[85dvh] border-b data-ending-style:-translate-y-full data-starting-style:-translate-y-full",
  right:
    "inset-y-0 right-0 h-dvh w-[min(100vw-1rem,28rem)] border-l data-ending-style:translate-x-full data-starting-style:translate-x-full",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] border-t data-ending-style:translate-y-full data-starting-style:translate-y-full",
  left:
    "inset-y-0 left-0 h-dvh w-[min(100vw-1rem,28rem)] border-r data-ending-style:-translate-x-full data-starting-style:-translate-x-full",
}

function Sheet(props: Drawer.Root.Props) {
  return <Drawer.Root {...props} />
}

function SheetTrigger({ className, ...props }: Drawer.Trigger.Props) {
  return <Drawer.Trigger className={cn(className)} {...props} />
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: Drawer.Popup.Props & { side?: SheetSide }) {
  return (
    <Drawer.Portal>
      <Drawer.Backdrop className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <Drawer.Popup
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border-border bg-background text-foreground shadow-lg outline-none transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none! data-ending-style:opacity-0 data-starting-style:opacity-0",
          sheetSideClasses[side],
          className,
        )}
        {...props}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
        <Drawer.Close
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 inline-flex size-7 items-center justify-center rounded-lg bg-background/90 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" />
        </Drawer.Close>
      </Drawer.Popup>
    </Drawer.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1 pr-8", className)} {...props} />
}

function SheetTitle({ className, ...props }: Drawer.Title.Props) {
  return (
    <Drawer.Title
      className={cn("text-base font-semibold leading-none tracking-normal", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: Drawer.Description.Props) {
  return (
    <Drawer.Description
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function SheetClose({ className, ...props }: Drawer.Close.Props) {
  return <Drawer.Close className={cn(className)} {...props} />
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
