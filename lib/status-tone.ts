export type StatusTone = 'default' | 'info' | 'success' | 'warning' | 'destructive'

export type DisplayStatus = {
  label: string
  detail: string
  tone: StatusTone
}

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  default: 'border-border bg-muted/40 text-muted-foreground',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  destructive: 'border-red-200 bg-red-50 text-red-700',
}
