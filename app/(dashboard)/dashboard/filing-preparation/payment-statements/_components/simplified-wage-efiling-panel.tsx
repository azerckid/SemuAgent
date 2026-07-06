import type { SimplifiedWageEfilingSummary } from '@/lib/efiling-simplified-wage/summary'
import { SimplifiedWageEfilingGenerateForm } from './simplified-wage-efiling-generate-form'

const LIST_TONE: Record<string, string> = {
  ok: 'text-[#16a34a]',
  warn: 'text-[#d97706]',
  danger: 'text-[#dc2626]',
  muted: 'text-company-fg-subtle',
}

const STAT_SUB = 'text-[11px] text-company-fg-subtle'

export function SimplifiedWageEfilingPanel({ efiling }: { readonly efiling: SimplifiedWageEfilingSummary }) {
  const { stats, formatChecks, validationItems } = efiling

  return (
    <section
      id="jc-030-efiling-panel"
      className="overflow-hidden rounded-xl border border-[#ddd6fe] bg-gradient-to-b from-[#faf5ff] to-company-surface shadow-company-card"
      aria-label="전자신고 파일 생성 패널"
    >
      <div className="flex flex-col gap-4 border-b border-[#e9e5ff] px-[18px] py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">간이지급명세서(근로소득) 전자신고 파일 후보</h3>
          <p className="mt-1 max-w-[720px] text-[12.5px] leading-relaxed text-company-fg-muted">
            확정된 반기 집계 데이터를 바탕으로 홈택스 <b className="font-semibold text-foreground">변환 파일제출</b>에 업로드할 파일을 준비합니다.
            자동 제출·자격증명 저장은 하지 않으며, 최종 업로드·제출은 사용자가 홈택스에서 직접 합니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href="#jc-030-validation-results"
            className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-xs font-semibold"
          >
            검증 결과 보기
          </a>
        </div>
      </div>

      <div className="grid gap-3 border-b border-[#e9e5ff] px-[18px] py-4 sm:grid-cols-3">
        <EfilingStat label="데이터 준비 완료" value={`${stats.readyCount}명`} sub="반기 집계·명부 매칭 완료" />
        <EfilingStat label="확인 필요" value={`${stats.attentionCount}명`} sub="급여 누락·인적사항 확인" />
        <EfilingStat label="식별정보 입력" value={`${stats.piiInputCount}명`} sub="파일 생성 직전 1회 입력 · 서버 미저장" />
      </div>

      <div className="grid gap-2 border-b border-[#e9e5ff] px-[18px] py-4 sm:grid-cols-2 lg:grid-cols-4">
        <StepCard step={1} title="데이터 확인" desc="JC-024 반기 집계·누락 검토" />
        <StepCard step={2} active title="식별정보 입력" desc="요청 동안만 사용 · DB·로그 미저장" />
        <StepCard step={3} title="사전검증" desc="파일변환신고 전 형식·정합성 확인" />
        <StepCard step={4} title="다운로드 · 홈택스 안내" desc="사용자 직접 변환제출" />
      </div>

      <div className="grid gap-4 px-[18px] py-4 lg:grid-cols-2">
        <div className="rounded-[10px] border border-company-border bg-company-surface p-3.5">
          <h4 className="text-[13px] font-semibold">파일 규격 상태</h4>
          <ul className="mt-2.5 space-y-1.5 text-[12.5px]">
            {formatChecks.map((item) => (
              <li key={item.id} className={LIST_TONE[item.tone] ?? LIST_TONE.muted}>
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div id="jc-030-validation-results" className="rounded-[10px] border border-company-border bg-company-surface p-3.5">
          <h4 className="text-[13px] font-semibold">사전검증 결과</h4>
          {validationItems.length === 0 ? (
            <p className="mt-2.5 text-[12.5px] text-company-fg-muted">검증할 직원 데이터가 없습니다.</p>
          ) : (
            <ul className="mt-2.5 space-y-1.5 text-[12.5px]">
              {validationItems.map((item) => (
                <li key={item.id} className={LIST_TONE[item.tone]}>
                  {item.employeeName ? (
                    <>
                      <span className="font-semibold">{item.employeeName}</span>
                      {' — '}
                      {item.message}
                    </>
                  ) : (
                    item.message
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5 text-[11.5px] text-[#1e3a8a]">
            <b className="text-[#172554]">PII 안내</b>
            {' — '}
            소득자 식별정보는 파일 생성에만 사용되며 서버·로그·스토리지에 저장되지 않습니다. 직원 명부에 주민등록번호를 추가하지 않습니다.
          </p>
        </div>
      </div>

      <SimplifiedWageEfilingGenerateForm efiling={efiling} />

      <div className="border-t border-[#e9e5ff] bg-[#faf5ff] px-[18px] py-3.5 text-[12px] leading-relaxed text-[#4c1d95]">
        <b className="text-[#3b0764]">책임 경계</b>
        {' — '}
        본 기능은 「전자신고 파일 후보」 생성·「파일변환신고 전 사전검증」까지입니다.
        홈택스 제출 보장·자동 신고·대리 제출을 표시하지 않습니다.
        {efiling.fileNamePreview && (
          <>
            {' '}
            예상 파일명: <span className="font-mono text-[11px]">{efiling.fileNamePreview}</span>
          </>
        )}
      </div>
    </section>
  )
}

function EfilingStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[10px] border border-[#e9e5ff] bg-company-surface px-3 py-2.5">
      <p className={`${STAT_SUB} font-medium`}>{label}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight">{value}</p>
      <p className={STAT_SUB}>{sub}</p>
    </div>
  )
}

function StepCard({
  step,
  title,
  desc,
  active,
}: {
  step: number
  title: string
  desc: string
  active?: boolean
}) {
  return (
    <div
      className={`rounded-[10px] border px-3 py-2.5 ${
        active
          ? 'border-[#7c3aed] bg-[#f5f3ff]'
          : 'border-company-border bg-company-surface opacity-80'
      }`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wide ${active ? 'text-[#7c3aed]' : 'text-company-fg-subtle'}`}>
        STEP {step}
      </p>
      <p className="mt-0.5 text-[12.5px] font-semibold">{title}</p>
      <p className="mt-0.5 text-[11px] text-company-fg-subtle">{desc}</p>
    </div>
  )
}
