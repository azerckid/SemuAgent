export function isGeminiEnabled(): boolean {
  const raw = process.env.GEMINI_ENABLED?.trim().toLowerCase()
  if (!raw) return true
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'
}
