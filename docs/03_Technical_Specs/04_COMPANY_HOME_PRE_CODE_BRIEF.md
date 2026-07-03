# Company Home Pre-Code Technical Brief
> Created: 2026-07-01 22:55
> Last Updated: 2026-07-03 15:46

## 1. Scope

JC-006 회사 홈 구현 직전 데이터·상태·acceptance 계약이다. 승인된
`00_company_home.html` 구조를 React/Next.js로 옮기되, JARYO-GIWA의 기존
대시보드 데이터 소스 중 회계사무소 요청·메일 중심 흐름은 사용하지 않는다.

회사 홈은 **읽기 전용 Server Component**로 시작한다. 기간 선택은 URL search param
컨텍스트만 바꾸며 DB mutation을 수행하지 않는다.

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | `app/(dashboard)/dashboard/page.tsx`를 회사 홈으로 재구성 |
| Layout | 기존 `app/(dashboard)/layout.tsx`와 Sidebar 재사용, 문구는 회사용으로 변경(JC-004 연계) |
| Data loader | `lib/company-home/summary.ts` 신규 후보. Server Component에서 직접 호출 |
| API route | 없음. 첫 구현은 서버 렌더링 read model로 충분 |
| Client state | 기간 선택 UI만 URL search param 갱신. 전역 상태 매니저 없음 |

기존 `app/(dashboard)/dashboard/page.tsx`의 카드/링크 구조와 shadcn `card`,
`badge`, `button`, `table` 사용 방식은 재사용 가능하다. 다만 현재 페이지가 읽는
`client_request_event`, `outbound_email` 기반 우선순위 로직은 v1 제외 범위라 회사
홈 데이터 소스에서 제거한다.

## 3. Data Contract

```ts
type CompanyHomePeriodKey = `${number}-H1` | `${number}-H2` | `${number}-Q${1 | 2 | 3 | 4}` | `${number}-${string}` | `${number}`

type CompanyHomeSummary = {
  tenant: {
    id: string
    name: string
    timezone: string
  }
  businessEntity: {
    id: string
    name: string
  } | null
  period: {
    key: CompanyHomePeriodKey
    label: string
    startMonth: string
    endMonth: string
    filingDeadline: string
    dDay: number
    progressPercent: number
  }
  actionItems: Array<{
    id: string
    title: string
    description: string
    tone: 'danger' | 'warn' | 'ok'
    count: number
    href: string
  }>
  workspaceCards: Array<{
    id: 'source_collection' | 'bookkeeping' | 'vat' | 'payroll' | 'filing_support' | 'receipts'
    title: string
    value: string
    statusLabel: string
    tone: 'ok' | 'warn' | 'danger' | 'muted'
    href: string
  }>
  recentRows: Array<{
    id: string
    kind: 'upload' | 'bookkeeping' | 'vat' | 'payroll' | 'filing_receipt'
    title: string
    periodLabel: string
    statusLabel: string
    occurredAt: string
    href: string
  }>
}
```

`businessEntity.id`는 DB 물리 컬럼상 `client.id`를 사용한다. 코드 내부 이름은
`businessEntityId`로 좁혀 쓰되, Drizzle 스키마의 실제 컬럼은 JC-005 후속
마이그레이션 전까지 `clientId` 그대로 참조한다.

## 4. Query Sources

| UI 영역 | 데이터 소스 | 최소 필드 | 계산/상태 |
|:---|:---|:---|:---|
| 인증·조직 | Better Auth session, `tenant` | `activeOrganizationId`, `tenant.id`, `tenant.name`, `tenant.timezone` | 미인증은 `/sign-in`, tenant 없으면 회사용 온보딩/접근 안내 |
| 사업장 컨텍스트 | `client` as business entity | `id`, `tenantId`, `name`, `email` | MVP는 tenant당 첫 사업장 1개. 없으면 빈 상태 |
| 기간 Hero | URL `period`, `lib/tax-calendar.ts` | period key, filing deadline, today | 기본값은 현재 신고 관련 기간. D-day와 진행률 파생 |
| 자료수집 카드 | `upload_session`, `upload_file`, `request_item_validation` | `status`, `source`, `uploadedAt`, `validationStatus`, `reviewStatus` | 내부 업로드(`source='staff_direct'`) 중심. 미수집/확인필요 건수 |
| 기장검토 카드 | `bookkeeping_classification_run`, `bookkeeping_transaction_classification`, `bookkeeping_journal_entry_run`, `bookkeeping_ledger_month` | run status, row status, counts, `periodMonth` | 미분류·확인필요·전표초안 상태 |
| 부가세 카드 | `bookkeeping_journal_entry_voucher(_line)` 우선, 신규 `vat_*` 후속 | line side/account/amount, period | 전용 VAT 테이블 전까지는 "검토 준비/잠금" read model만 표시 |
| 급여 카드 | `payroll_extraction_batch`, `payroll_extraction_row`, `payroll_excel_draft` | batch status, row verdict, period, draft status | 확인 필요 직원/급여 초안 준비 상태 |
| 신고지원 카드 | 신규 `filing_*` 후속, 현재는 VAT/payroll 산출물 파생 | filing status, receipt status | 전용 테이블 전까지 패키지 잠금/대기 상태 |
| 최근 제출·영수증 | `upload_file`, `payroll_excel_draft`, 후속 `filing_receipt` | title/status/timestamp/storage key 없음 | private storage key는 표시하지 않음. 사용자에게 안전한 제목만 노출 |

명시적 제외: 회사 홈 구현에서 `request_template`, `client_request_schedule`,
`client_request_event`, `outbound_email`, `inbound_email`, `staff_mailbox` 계열은 읽지
않는다. 이 테이블들은 GIWA 회계사무소 요청·메일 흐름이며 세무 에이전트 v1 책임
경계와 맞지 않는다.

## 5. Derivation Rules

- 모든 쿼리는 `tenantId`와 `businessEntityId`(`clientId`)를 함께 제한한다.
- 기간 필터는 `period.startMonth <= rowMonth <= period.endMonth` 기준으로 적용한다.
- `actionItems` 우선순위는 danger → warn → ok 순서다.
- 미수집 자료는 `request_item_validation.validationStatus in ('missing', 'non_compliant', 'uncertain')` 중 `reviewStatus != 'excluded'`인 항목으로 센다.
- 미분류 거래는 `bookkeeping_transaction_classification.status in ('needs_decision', 'unclassified')` 또는 최신 run의 `unclassifiedRowCount > 0`을 우선한다.
- 부가세 공제 검토 수는 `vat_deduction_review`가 생기기 전까지 journal/voucher 기반 파생값을 표시하지 않고, "기장 확정 후 산출" 상태로 둔다.
- 급여 확인 필요는 최신 `payroll_extraction_batch`의 `payroll_extraction_row.aiVerdict='fail'` 또는 필수 필드 누락 row 수로 센다.
- 최근 행은 private blob URL, 원본 파일 storage key, 이메일 주소, 주민정보를 표시하지 않는다.

## 6. Mutation and State

| 항목 | 방침 |
|:---|:---|
| DB mutation | 없음 |
| URL mutation | `?period=2026-H1` 같은 search param 변경만 허용 |
| Loading | `loading.tsx` 또는 `Suspense` skeleton으로 카드·표 골격 표시 |
| Empty | business entity 없음, 자료 없음, 최근 이력 없음 각각 분리 |
| Error | 데이터 로드 실패 시 "현황을 불러오지 못했습니다" + 다시 시도 |
| Permission | tenant 미소속/사업장 미소속은 회사용 안내. 회계법인 문구 금지 |

## 7. Implementation Sequence

1. `lib/company-home/summary.ts`에 read model loader와 순수 파생 함수 작성.
2. `app/(dashboard)/dashboard/page.tsx`에서 GIWA 메일/요청 쿼리 제거.
3. Sidebar 문구를 회사 홈·자료수집·기장검토·부가세·급여·신고지원 구조로 교체(JC-004 연계).
4. 승인 Preview의 Hero, Action Row, Status Card, Recent Table, State Card를 React 컴포넌트로 분리.
5. `lib/company-home/summary.test.ts`로 기간 파생, 우선순위 정렬, tenant/business entity scope, 제외 테이블 미사용 방침을 검증.

## 8. Acceptance Criteria

- 로그인 직후 `/dashboard`가 회사 홈으로 보이고 마케팅 페이지가 아니다.
- 화면 구조가 승인된 `00_company_home.html`의 Hero → 다음 할 일 → 준비 현황 → 최근 제출·영수증 순서를 따른다.
- 회사 홈 데이터 로더는 `client_request_event`, `outbound_email`, `inbound_email`, `staff_mailbox` 계열을 참조하지 않는다.
- 모든 데이터 쿼리는 `tenantId`와 `businessEntityId` 범위를 벗어나지 않는다.
- 기간 변경은 URL 컨텍스트만 갱신하고 DB에 저장하지 않는다.
- 로딩·빈·오류 상태가 각각 표시된다.
- 회사 홈에서는 업로드, 승인, 패키지 생성, 접수증 업로드 같은 mutation을 수행하지 않는다.

## 9. Open Items

- Layer 5 회사 홈 QA 시나리오 작성 완료: [02_COMPANY_HOME_TEST_SCENARIOS.md](../05_QA_Validation/02_COMPANY_HOME_TEST_SCENARIOS.md) (S-01~S-82).
- JC-005 후속에서 `business_entity` 물리 rename을 선택하면 이 문서의 `clientId` 참조를 함께 갱신한다.
- `vat_*`, `filing_*` 테이블이 확정되기 전까지 회사 홈은 부가세/신고지원 상세 수치를 잠금/대기 상태로 표시한다.

## 10. Implementation Notes

- 구현 브랜치: `feat-jc-006-company-home`
- Read model: `lib/company-home/summary.ts`
- 화면: `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/dashboard/_components/company-home.tsx`
- 상태 경계: `app/(dashboard)/dashboard/loading.tsx`, `app/(dashboard)/dashboard/error.tsx`
- 테스트: `lib/company-home/summary.test.ts` — 기간 파생, actionItems 우선순위, status card 파생, 기간 필터, 제외 테이블 미참조, read-only 정적 검증.
- 부가세/신고지원은 전용 React 라우트가 아직 없으므로 회사 홈 섹션 앵커로 연결한다. 전용 작업공간은 JC-011/JC-013에서 구현한다.

## 11. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용 책임 경계
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 회사 홈 입출력과 동선
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 회사 홈 컴포넌트 구조
- **UI_Screens**: [Company Home Review](../02_UI_Screens/02_COMPANY_HOME_PROTOTYPE_REVIEW.md) - 사용자 확인 기록
- **UI_Screens**: [HTML Preview](../02_UI_Screens/previews/00_company_home.html) - 승인된 화면 기준
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) - 구현 컴포넌트·라이브러리 계획
- **Technical_Specs**: [DB Schema](./03_DB_SCHEMA.md) - `client` → `business_entity` 재정의와 테이블 매핑
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-006 Context Lock
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) - 구현 검증 기준선
