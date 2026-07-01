export function buildSenderFooterText(params: {
  staffName: string
  staffEmail: string
  senderPhone?: string
}): string {
  return [
    '감사합니다.',
    `${params.staffName} 드림`,
    `이메일: ${params.staffEmail}`,
    params.senderPhone ? `전화: ${params.senderPhone}` : null,
  ].filter(Boolean).join('\n')
}

export function buildRequestEmailHtml(params: {
  expiryDate: string
  greeting: string
  requestBody: string
  senderFooter: string
  uploadUrl: string
}): string {
  const expiryDate = escHtml(params.expiryDate)
  const greeting = fmtText(params.greeting)
  const requestBody = fmtText(params.requestBody)
  const senderFooter = fmtText(params.senderFooter)
  const url = encodeURI(params.uploadUrl)
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1a1a1a;background:#ffffff;">
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${greeting}</p>
  <div style="font-size:15px;line-height:1.7;margin:0 0 24px;">${requestBody}</div>
  <a href="${url}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500;">자료 제출하기</a>
  <p style="font-size:13px;color:#6b7280;margin:24px 0 0;">제출 기한: ${expiryDate}</p>
  <p style="font-size:13px;color:#4b5563;line-height:1.7;margin:20px 0 0;">${senderFooter}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:12px;color:#9ca3af;margin:0;">이 메일은 자동 발송되었습니다. 문의 사항이 있으시면 담당 회계사에게 직접 연락해 주세요.</p>
</body></html>`
}

export function buildStaffRequestConfirmationHtml(params: {
  clientName: string
  clientEmail: string
  staffName: string
  accountingPeriod: string
  expiryDate: string
  requestSubject: string
  requestBody: string
  uploadUrl: string
  sessionUrl: string
}): string {
  const clientName = escHtml(params.clientName)
  const clientEmail = escHtml(params.clientEmail)
  const staffName = escHtml(params.staffName)
  const period = escHtml(params.accountingPeriod)
  const expiryDate = escHtml(params.expiryDate)
  const requestSubject = escHtml(params.requestSubject)
  const requestBody = fmtText(params.requestBody)
  const uploadUrl = encodeURI(params.uploadUrl)
  const sessionUrl = encodeURI(params.sessionUrl)
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;padding:40px 20px;color:#1a1a1a;background:#ffffff;">
  <h2 style="font-size:20px;font-weight:600;margin:0 0 20px;">자료 요청 발송 확인</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">안녕하세요, ${staffName} 담당자님.</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;"><strong>${clientName}</strong> (${clientEmail})에게 ${period} 자료 요청 메일이 발송되었습니다.</p>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin:0 0 20px;">
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">발송 제목</p>
    <p style="font-size:15px;font-weight:600;margin:0 0 16px;">${requestSubject}</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">발송 본문</p>
    <div style="font-size:14px;line-height:1.7;margin:0;">${requestBody}</div>
  </div>
  <p style="font-size:13px;color:#6b7280;margin:0 0 18px;">제출 기한: ${expiryDate}<br>업로드 링크: <a href="${uploadUrl}" style="color:#2563eb;">${uploadUrl}</a></p>
  <a href="${sessionUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">세션 상세 보기</a>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:12px;color:#9ca3af;margin:0;">JARYO 자동 알림 · 이 메일에 회신하지 마세요.</p>
</body></html>`
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function fmtText(str: string): string {
  return escHtml(str).replace(/\n/g, '<br>')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function formatAccountingPeriod(period: string): string {
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const [year, q] = period.split('-Q')
    return `${year}년 ${q}분기`
  }
  if (/^\d{4}-H[1-2]$/.test(period)) {
    const [year, h] = period.split('-H')
    return `${year}년 ${h === '1' ? '상반기' : '하반기'}`
  }
  if (/^\d{4}$/.test(period)) {
    return `${period}년`
  }
  // YYYY-MM
  const [year, month] = period.split('-')
  return `${year}년 ${parseInt(month, 10)}월`
}

export function buildCompletionThanksHtml(params: {
  clientName: string
  staffName: string
  accountingPeriod: string
}): string {
  const period = escapeHtml(params.accountingPeriod)
  const client = escapeHtml(params.clientName)
  const staff = escapeHtml(params.staffName)
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; background: #ffffff;">
  <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 24px;">${period} 기장 자료 제출 완료</h2>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">안녕하세요, ${client} 담당자님.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    ${period} 기장 처리를 위한 자료 제출이 완료되었습니다.<br>
    신속한 자료 제출에 감사드립니다. 기장 처리 후 별도로 안내드리겠습니다.
  </p>
  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
    <p style="font-size: 14px; color: #15803d; margin: 0;">✓ 모든 필수 자료가 정상적으로 접수되었습니다.</p>
  </div>
  <p style="font-size: 13px; color: #6b7280; margin: 0;">
    담당: ${staff}
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
    이 메일은 자동 발송되었습니다. 문의 사항이 있으시면 담당 회계사에게 직접 연락해 주세요.
  </p>
</body>
</html>`
}

export function buildReminderHtml(params: {
  clientName: string
  staffName: string
  accountingPeriod: string
  expiryDate: string
  uploadUrl: string
}): string {
  const period = escapeHtml(params.accountingPeriod)
  const client = escapeHtml(params.clientName)
  const staff = escapeHtml(params.staffName)
  const expiry = escapeHtml(params.expiryDate)
  const url = encodeURI(params.uploadUrl)
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; background: #ffffff;">
  <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 24px;">${period} 기장 자료 제출 기한 안내</h2>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">안녕하세요, ${client} 담당자님.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    ${period} 기장 자료 제출 기한이 <strong>${expiry}</strong>까지입니다.<br>
    아직 제출되지 않은 자료가 있으면 아래 링크를 통해 업로드해 주세요.
  </p>
  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin: 0 0 24px;">
    <p style="font-size: 13px; color: #92400e; margin: 0;">⚠ 기한 내 제출이 어려우시면 담당 회계사에게 연락해 주세요.</p>
  </div>
  <a href="${url}"
     style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">
    자료 제출하기
  </a>
  <p style="font-size: 13px; color: #6b7280; margin: 24px 0 0;">
    제출 기한: ${expiry}<br>
    담당: ${staff}
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 12px; color: #9ca3af; margin: 0;">이 메일은 자동 발송되었습니다.</p>
</body>
</html>`
}

export function buildStaleNotifyHtml(params: {
  staffName: string
  clientName: string
  accountingPeriod: string
  staleDays: number
  sessionUrl: string
}): string {
  const staff = escapeHtml(params.staffName)
  const client = escapeHtml(params.clientName)
  const period = escapeHtml(params.accountingPeriod)
  const url = encodeURI(params.sessionUrl)
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; background: #ffffff;">
  <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 24px;">자료 미제출 세션 알림</h2>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">안녕하세요, ${staff} 담당자님.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    <strong>${client}</strong>의 ${period} 자료 제출 세션이
    <strong>${params.staleDays}일째</strong> 활동이 없습니다.<br>
    클라이언트에게 추가 연락이 필요할 수 있습니다.
  </p>
  <a href="${url}"
     style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">
    세션 상세 보기
  </a>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 12px; color: #9ca3af; margin: 0;">JARYO 자동 알림 · 이 메일에 회신하지 마세요.</p>
</body>
</html>`
}

export function buildStaffNotificationHtml(params: {
  staffName: string
  clientName: string
  accountingPeriod: string
  sessionUrl: string
}): string {
  const staff = escapeHtml(params.staffName)
  const client = escapeHtml(params.clientName)
  const period = escapeHtml(params.accountingPeriod)
  const url = encodeURI(params.sessionUrl)
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; background: #ffffff;">
  <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 24px;">자료 제출 완료 알림</h2>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">안녕하세요, ${staff} 담당자님.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    <strong>${client}</strong>의 ${period} 기장 자료 제출이 완료되었습니다.<br>
    아래 링크에서 세션 상세를 확인하세요.
  </p>
  <a href="${url}"
     style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">
    세션 상세 보기
  </a>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
    JARYO 자동 알림 · 이 메일에 회신하지 마세요.
  </p>
</body>
</html>`
}
