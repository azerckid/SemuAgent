export function isMissingInternalCcGroupTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : ''

  return [message, causeMessage].some((value) => value.includes('no such table: internal_cc_group'))
}
