'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface DeleteConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  loading = false,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [loading, onCancel, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
        className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl"
      >
        <h2 id="delete-confirm-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p id="delete-confirm-description" className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? `${confirmLabel} 중...` : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
