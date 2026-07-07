import {
  HOMETAX_RESOURCE_PORTAL_URL,
  HOMETAX_SIMPLIFIED_WAGE_CONVERT_URL,
  HOMETAX_SIMPLIFIED_WAGE_UPLOAD_STEPS,
  NTS_SIMPLIFIED_WAGE_DUTY_URL,
  NTS_SIMPLIFIED_WAGE_SUBMISSION_METHOD_URL,
  SIMPLIFIED_WAGE_OPERATIONAL_CHECKLIST,
} from '@/lib/efiling-simplified-wage/hometax-guide'

export function SimplifiedWageEfilingUploadGuide() {
  return (
    <section
      id="jc-030-hometax-guide"
      className="border-t border-[#e9e5ff] px-[18px] py-4"
      aria-label="홈택스 변환제출 안내"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-[13px] font-semibold">홈택스 변환제출 안내</h4>
          <p className="mt-1 max-w-[640px] text-[12px] text-company-fg-muted">
            plain 파일은 암호화 전 검증용 후보입니다.
            홈택스 제출은 NTS-CRYPTO 암호화·적합성 검정 확인 후 사용자가 직접 진행합니다.
            SemuAgent는 홈택스에 로그인하거나 제출하지 않습니다.
          </p>
        </div>
        <a
          href={HOMETAX_SIMPLIFIED_WAGE_CONVERT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-[#7c3aed] bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white"
        >
          홈택스 변환제출 메뉴 열기
        </a>
      </div>

      <ol className="mt-4 space-y-1.5 text-[12.5px] text-foreground">
        {HOMETAX_SIMPLIFIED_WAGE_UPLOAD_STEPS.map((step) => (
          <li key={step.order} className="flex gap-2">
            <span className="font-semibold text-[#7c3aed]">{step.order}.</span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-3 text-[11.5px]">
        <ExternalDocLink href={NTS_SIMPLIFIED_WAGE_SUBMISSION_METHOD_URL} label="국세청 제출 방법 안내" />
        <ExternalDocLink href={NTS_SIMPLIFIED_WAGE_DUTY_URL} label="제출 의무·주기 안내" />
        <ExternalDocLink href={HOMETAX_RESOURCE_PORTAL_URL} label="홈택스 자료실" />
      </div>

      <div className="mt-4 rounded-[10px] border border-company-border bg-[#fafafa] p-3.5">
        <h5 className="text-[12.5px] font-semibold">제출 반기 운영 체크리스트</h5>
        <p className="mt-1 text-[11px] text-company-fg-muted">
          담당자가 제출 직전에 수행합니다 (Brief §9).
        </p>
        <ul className="mt-2.5 space-y-1.5 text-[12px] text-company-fg-muted">
          {SIMPLIFIED_WAGE_OPERATIONAL_CHECKLIST.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span className="text-company-fg-subtle">-</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-[11px] text-company-fg-subtle">
        v1은 plain 레코드 파일 후보를 제공합니다. 홈택스가 암호화(NTS-CRYPTO) 파일 또는 적합성 검정 통과 파일만 허용하면 제출에는 사용할 수 없습니다.
      </p>
    </section>
  )
}

function ExternalDocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[#2563eb] underline-offset-2 hover:underline"
    >
      {label}
    </a>
  )
}
