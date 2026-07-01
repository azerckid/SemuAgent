export function normalizeSessionDisplayLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function formatNumberedSessionDisplayLabel(baseName: string, index: number) {
  const safeBaseName = normalizeSessionDisplayLabel(baseName) || '고객사'
  return `${safeBaseName}_${String(index).padStart(2, '0')}`
}
