export function normalizeEvaluationFilenameKey(filename: string) {
  return filename.normalize('NFC').toLowerCase()
}
