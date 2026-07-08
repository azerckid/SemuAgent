// Brief 41 §0.2 "Private/business-unrelated detection": flag likely
// personal/low-business-use spending (cinema, beauty salon, PC room,
// leisure-like spending) as a heuristic/AI review flag — never an automatic
// exclusion. Keyword list mirrors the categories already used in
// reconciliation-sample-generator.ts's PERSONAL_CARD_TEMPLATES.
const PERSONAL_USE_KEYWORDS = [
  'cgv', '메가박스', '롯데시네마', '영화관', '영화 관람',
  'pc방', '피시방',
  '미용실', '헤어살롱', '헤어샵', '네일샵', '네일아트',
  '노래방', '코인노래방',
  '마사지', '스파', '피부관리',
  '헬스장', '피트니스',
]

export function looksPersonallyUseSuspicious(input: {
  counterparty: string | null
  description: string
}): boolean {
  const haystack = `${input.counterparty ?? ''} ${input.description}`.toLowerCase()
  return PERSONAL_USE_KEYWORDS.some((keyword) => haystack.includes(keyword))
}
