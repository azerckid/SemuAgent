import * as React from "react"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="tabs" className={cn("flex flex-col gap-3", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      className={cn("inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-background p-1", className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  active,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      data-slot="tabs-trigger"
      data-state={active ? "active" : "inactive"}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-bold whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="tabs-content" role="tabpanel" className={cn("outline-none", className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
