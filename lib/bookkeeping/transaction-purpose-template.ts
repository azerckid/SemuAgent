// 거래 용도 확인 메일 본문 템플릿과 플레이스홀더 치환.
// docs/03_Technical_Specs/40_TRANSACTION_PURPOSE_CONFIRMATION_SPEC.md §7
// 본문 규칙: 인사, 목적, 보안 링크, 답변 기한, 담당자 서명. 거래 상세 나열 금지.

export const PURPOSE_PLACEHOLDERS = {
  clientName: '[[고객명]]',
  tenantName: '[[회계사무소]]',
  staffName: '[[담당자]]',
  uploadLink: '[[업로드링크]]',
  dueAt: '[[답변기한]]',
} as const

// create 시 draft에 미리 채워두는 기본 본문. 담당자가 편집 후 발송.
export function buildDefaultPurposeBodyTemplate(): string {
  return [
    '[[고객명]] 담당자님 안녕하세요,',
    '',
    '[[회계사무소]] [[담당자]]입니다.',
    '회계처리를 위해 일부 거래의 용도 확인이 필요합니다.',
    '',
    '아래 링크에서 확인해 주시면 감사하겠습니다.',
    '[[업로드링크]]',
    '',
    '답변 기한: [[답변기한]]',
    '',
    '감사합니다.',
    '[[담당자]] 드림',
  ].join('\n')
}

export type PurposeTemplateContext = {
  clientName: string
  tenantName: string
  staffName: string
  uploadLink: string
  dueAt: string | null
}

// 본문/제목의 플레이스홀더를 실데이터로 치환. 발송 시점과 미리보기에서 모두 사용.
export function resolvePurposeTemplate(text: string, ctx: PurposeTemplateContext): string {
  return text
    .split(PURPOSE_PLACEHOLDERS.clientName).join(ctx.clientName)
    .split(PURPOSE_PLACEHOLDERS.tenantName).join(ctx.tenantName)
    .split(PURPOSE_PLACEHOLDERS.staffName).join(ctx.staffName)
    .split(PURPOSE_PLACEHOLDERS.uploadLink).join(ctx.uploadLink)
    .split(PURPOSE_PLACEHOLDERS.dueAt).join(ctx.dueAt ?? '별도 안내')
}
