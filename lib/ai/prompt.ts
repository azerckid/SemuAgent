import type { AnalyzeParams } from '@/lib/validations/analysis'

export const SYSTEM_PROMPT = `당신은 한국 회계법인의 기장 자료를 분석하는 전문 AI입니다.
업로드된 파일을 분석하여 체크리스트 매칭과 담당자 검토를 위한 구조화 결과를 생성합니다.
반드시 순수한 JSON만 출력하세요. 코드 블록(마크다운), 설명 텍스트 없이 JSON 객체만 출력합니다.`

export function buildAnalysisPrompt(params: AnalyzeParams): string {
  const checklistJson = params.checklistItems.length > 0
    ? JSON.stringify(
        params.checklistItems.map((i) => ({ id: i.id, name: i.name, required: i.required })),
        null,
        2,
      )
    : '(배정된 체크리스트 항목 없음 — 자료 유형만 분류하세요)'

  const notesSection = buildNotesSection(
    params.clientAnalysisNotes,
    params.sessionAnalysisNotes,
    params.extractedCriteria,
    params.additionalCriteria,
  )

  const extractedTextSection = buildExtractedTextSection(
    params.extractedText,
    params.extractionSummary,
  )

  const visionNote =
    params.fileType === 'excel' && !params.extractedText
      ? '\n[참고] Excel 시트 텍스트 추출에 실패한 경우에만 파일명과 메타데이터 기반으로 보수적으로 분류하세요.'
      : params.fileBuffer === null
        ? '\n[참고] 파일 크기가 크거나 지원되지 않는 형식이므로 파일명과 메타데이터 기반으로 분류하세요.'
        : ''

  return `다음 회계 자료를 분석해 주세요.${visionNote}

**요청 회계 기간**: ${params.accountingPeriod}
**파일명**: ${params.originalFilename}
**파일 유형**: ${params.fileType}
${extractedTextSection}

**체크리스트 항목** (아래 항목 중 하나를 checklist_item_id로 선택하세요):
${checklistJson}
${notesSection}
분석 원칙:
- 추출 텍스트나 첨부 파일에서 확인 가능한 내용은 AI가 직접 판독해 판단하세요.
- 클라이언트가 종이 자료를 사진으로 찍어 올린 이미지도 실제 문서로 판독하세요. 사진 안의 제목, 발행처/거래처, 일자, 금액, 사업자번호, 계좌/카드/영수증 표시를 근거로 자료 유형을 분류하세요.
- 파일명과 내부 시트명/헤더/샘플 행이 충돌하면 파일명보다 내부 내용을 우선하세요.
- 파일명이나 촬영 폴더명만으로 자료 유형을 확정하지 마세요. 사진/문서 내부에서 자료 유형을 확인하지 못하면 matched_candidate로 두지 말고 needs_review로 남기세요.
- 파일명은 네이버페이, 은행, KCP처럼 보이지만 내부 헤더가 전혀 다른 자료(예: 부가세 신고기간별 월별 집계표)라면 요청자료에 매칭하지 말고 routing_status는 needs_review, material_status는 insufficient로 두세요.
- 거래자료로 인정하려면 거래일자/증빙일자, 거래처 또는 적요, 건별 금액처럼 거래행을 식별할 수 있는 근거가 있어야 합니다. 월별 합계표만 있으면 기장 거래자료로 sufficient 처리하지 마세요.
- 엑셀 상단의 계좌번호, 예금주명, 조회기간, 현재잔액, 조회기준일 같은 설명행은 표 헤더가 아닙니다. 실제 표 헤더와 거래행을 분리해서 판단하세요.
- "담당자가 직접 열람하세요", "담당자가 확인하세요"처럼 판단을 회계담당자에게 되돌리는 표현은 최후의 예외 상황이 아니면 사용하지 마세요.
- 핵심 필드(일자, 금액, 거래처, 사업자번호, 계좌/카드/영수증 유형 등)를 추출할 수 있으면 extracted_fields에 반드시 구조화하세요.
- 판독이 일부 불충분하면 무엇이 읽혔고 무엇이 부족한지 구분해서 설명하세요.
- 단순히 체크리스트가 없다는 이유만으로 파일 내용을 확인할 수 없다고 말하지 마세요.
- checklist_item_id가 null이거나 routing_status가 needs_review인 경우 unmatch_reason_code와 staff_unlinked_reason을 작성하세요.
- unmatch_reason_code는 내부 분류용 enum입니다. 화면 문구로 사용하지 않습니다.
- unmatch_reason_code: filename_content_mismatch | period_out_of_scope | not_checklist_material | summary_not_transaction_detail | journal_entry_candidate | other
- staff_unlinked_reason: **필수**(checklist_item_id가 null일 때). 미연결 **사유만** 1~2문장 한국어로 작성하세요.
- staff_unlinked_reason에는 왜 요청자료 체크리스트에 자동 연결되지 않았는지, 담당자가 다음에 무엇을 하면 되는지 적으세요.
- staff_unlinked_reason에는 시트 목록·금액·거래 상세 같은 **파일 내용 나열**을 넣지 마세요. explanation과 duplicate하지 마세요.
- 예시(그대로 복사하지 말고 문서에 맞게 작성): "입출금 내역이 모두 포함되어 있어 지출결의서로 분류하기 어렵습니다. 요청자료 체크리스트와 연결되지 않으므로 귀속·전표 단계에서 검토하세요."
- unlinked_context는 선택 보조 필드입니다.

다음 JSON 형식으로 응답하세요:
{
  "detected_file_type": "감지된 자료 유형 (예: 매출세금계산서, 통장사본, 경비영수증, 계약서, 급여대장, 현금영수증, 기타)",
  "readability_score": 0.0~1.0,
  "checklist_item_id": "위 체크리스트 ID 중 하나 또는 null",
  "classification_confidence": 0.0~1.0,
  "extracted_fields": { "field_name": "value" },
  "period_match": "matched|partial|unmatched|unknown",
  "material_status": "sufficient|insufficient|unknown",
  "risk_flags": ["리스크 사유"],
  "routing_status": "matched_candidate|needs_review|failed",
  "confidence": 0.0~1.0,
  "explanation": "판단 근거 요약 (2~4문장, 한국어). 내부 분석용이며 파일 내용 설명을 포함할 수 있습니다.",
  "uncertainty": "불확실한 부분 또는 null",
  "recommended_action": "담당자 권장 조치 또는 null",
  "criteria_summary": "적용된 담당자 기준 요약 또는 null",
  "unmatch_reason_code": "filename_content_mismatch|period_out_of_scope|not_checklist_material|summary_not_transaction_detail|journal_entry_candidate|other|null",
  "staff_unlinked_reason": "미연결 사유 1~2문장 또는 null",
  "unlinked_context": {
    "filename_label": "파일명에서 읽은 자료명",
    "detected_shape": "실제 확인한 문서 형식",
    "requested_period": "요청 기간",
    "next_step": "다음 검토 단계"
  }
}`
}

function buildExtractedTextSection(
  extractedText?: string | null,
  extractionSummary?: string | null,
): string {
  if (!extractedText && !extractionSummary) return ''

  const lines = ['\n**서버 전처리 추출 결과**:']
  if (extractionSummary) lines.push(`- 추출 상태: ${extractionSummary}`)
  if (extractedText) {
    lines.push(`\n아래 텍스트/시트 내용은 서버가 파일에서 직접 추출한 내용입니다. 이 내용을 우선 근거로 사용하세요.\n---\n${extractedText}\n---`)
  } else {
    lines.push('- 추출 텍스트 없음. 첨부 파일이 함께 제공된 경우 해당 파일을 직접 판독하세요.')
  }
  return lines.join('\n') + '\n'
}

function buildNotesSection(
  clientNotes?: string | null,
  sessionNotes?: string | null,
  extractedCriteria?: string | null,
  additionalCriteria?: string | null,
): string {
  if (!clientNotes && !sessionNotes && !extractedCriteria && !additionalCriteria) return ''

  const lines = ['\n**담당자 제공 업무 기준** (참고하되, 파일 근거 없이 자동 매칭하지 마세요):']
  if (clientNotes) lines.push(`- 회사 기본 기준: ${clientNotes}`)
  if (sessionNotes) lines.push(`- 기존 세션 기준: ${sessionNotes}`)
  if (extractedCriteria) lines.push(`- 요청 메일에서 추출한 기준: ${extractedCriteria}`)
  if (additionalCriteria) lines.push(`- 담당자 추가 판단 기준: ${additionalCriteria}`)
  return lines.join('\n') + '\n'
}

export function extractJsonFromResponse(text: string): string | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return jsonMatch ? jsonMatch[0] : null
}
