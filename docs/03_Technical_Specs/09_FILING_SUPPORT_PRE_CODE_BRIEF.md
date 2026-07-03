# Filing Support Pre-Code Technical Brief
> Created: 2026-07-02 20:23
> Last Updated: 2026-07-03 15:46

## 0. Governing Principle - Preview UI가 계약이다

JC-013 신고지원 화면은 승인된 [05_filing_support.html](../02_UI_Screens/previews/05_filing_support.html)
구조를 실제 제품 화면으로 옮긴다. 신고지원은 자동 제출 기능이 아니라, 부가세·급여에서 생성된
내부 산출물을 모아 회사가 직접 신고할 수 있게 돕는 워크스페이스다.

- 보이는 UI는 회사용 `/dashboard/filing-support` 화면으로 새로 구성한다.
- 회사 홈의 기존 `#filing-support-status` 앵커는 구현 후 전용 route로 재지정한다.
- 부가세(JC-011)와 급여(JC-012)의 read model·package/document 상태를 내부 의존성으로 재사용한다.
- 자동 홈택스 제출, 자동 납부, 홈택스/EDI 자격증명 서버 저장, 공동인증서 보관은 v1 범위 밖이다.
- 상단 책임 경계 배너와 하단 안내에는 "세무 에이전트는 신고서 제출을 대행하지 않는다"는 문구를 유지한다.

## 1. Scope

JC-013 신고지원 구현 직전 계약. 다음 화면 단위를 제공한다.

1. 신고 항목·첨부 패키지(부가세, 원천세, 4대보험)
2. 선행 화면 연동 상태(부가세 공제 검토, 원천징수 지급명세서, 4대보험 자료)
3. 홈택스 입력 가이드와 값 복사
4. 제출 접수증 업로드·보관
5. 사후 체크리스트
6. 로딩, 빈 상태, 오류 상태

JC-013 구현은 `filing_item`, `filing_receipt`, `filing_checklist_item` 테이블을 먼저 추가한 뒤
read model과 화면을 구현한다. 입력 가이드 값은 선행 화면의 확정 값에서 파생하고, 실제 제출/납부 결과는
사용자가 업로드한 접수증과 체크리스트 상태로만 기록한다.

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | 신규 `/dashboard/filing-support`, 물리 경로 `app/(dashboard)/dashboard/filing-support/` |
| 사이드바·홈 CTA | Sidebar "신고지원"과 회사 홈 신고지원 카드는 `/dashboard/filing-support`로 이동 |
| Read model | `lib/filing-support/summary.ts` 신규. Server Component에서 호출 |
| Persistence | `filing_item`, `filing_receipt`, `filing_checklist_item` 신규 Drizzle 테이블 |
| Internal dependencies | `vat_period_summary`, `payroll_period_summary` |
| Mutation API | 접수증 업로드/삭제, 체크리스트 완료 상태 갱신, 패키지 상태 동기화 API 신규 |
| Client UI | `_components/filing-support-workspace.tsx` 신규. Preview 4.6 구조 |
| 기간 컨텍스트 | URL `?period=`, 기본값은 현재 신고 대상 부가세 기간 + 해당 급여 귀속월 |
| Submission boundary | 홈택스/EDI 자동 제출·자동 납부 API 없음 |

## 3. Data Contract

```ts
type FilingItemType = 'vat' | 'withholding' | 'social_insurance'
type FilingPackageStatus = 'locked' | 'ready' | 'generated' | 'submitted'
type FilingItemStatus = 'locked' | 'ready' | 'needs_review' | 'submitted'
type FilingReceiptStatus = 'missing' | 'stored'
type FilingTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info'

type FilingSupportSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: {
    filingPeriodKey: string
    filingLabel: string
    payrollPeriodKey: string
    payrollLabel: string
  }
  responsibility: {
    title: string
    description: string
  }
  items: Array<{
    id: string
    type: FilingItemType
    title: string
    description: string
    sourceModule: 'vat' | 'payroll'
    sourceRefId: string | null
    status: FilingItemStatus
    statusLabel: string
    packageStatus: FilingPackageStatus
    packageStatusLabel: string
    lockReason: string | null
    primaryActionLabel: string
    secondaryHref: string
    tone: FilingTone
  }>
  guide: {
    title: string
    description: string
    targetItemType: FilingItemType
    steps: Array<{
      number: number
      title: string
      description: string
      values: Array<{ label: string; value: string }>
      done: boolean
    }>
    copyPayload: string
    downloadActionLabel: string | null
  }
  receipts: Array<{
    id: string
    itemType: FilingItemType
    title: string
    description: string
    status: FilingReceiptStatus
    uploadedAt: string | null
    storageKey: string | null
  }>
  checklist: Array<{
    id: string
    label: string
    description: string
    completed: boolean
    itemType: FilingItemType | null
  }>
}
```

## 4. Query Sources

| UI 영역 | 데이터 소스 | 최소 필드 | 계산/상태 |
|:---|:---|:---|:---|
| 인증·조직·사업장 | Better Auth session, `tenant`, `client` | tenantId, businessEntityId | 미인증 `/sign-in`, 사업장 없으면 빈 상태 |
| 기간 | URL `period`, `buildCompanyHomePeriod`, 최신 payroll period | filingPeriodKey, payrollPeriodKey | 부가세 1기/2기 + 해당 급여 귀속월 |
| 부가세 항목 | `vat_period_summary` | pendingDeductionCount, payableTaxKrw, packageStatus, packageStorageKey | pending > 0이면 패키지 잠금 |
| 원천세 항목 | `payroll_period_summary` | employeeCount, grossPayKrw, withholdingTaxKrw, withholdingStatementStatus, closeStatus | 지급명세서 생성 상태와 홈택스 입력 가이드 |
| 4대보험 항목 | `payroll_period_summary` | socialInsuranceKrw, noticeImportStatus, insuranceStatementStatus, issueCount | 고지액 매칭·자료 생성 필요 여부 |
| 신고 항목 상태 | `filing_item` | itemType, status, packageStatus, lockReason, sourceRefId | 화면 카드의 상태칩·CTA |
| 제출 접수증 | `filing_receipt` | receiptType, originalFilename, storageKey, uploadedAt | 보관 완료/업로드 대기 |
| 사후 체크리스트 | `filing_checklist_item` | code, label, completed, completedAt | 납부·접수증 보관 완료 상태 |

### 4.1 신규 테이블 최소 논리 컬럼

`filing_item`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId` | tenant + businessEntity 범위 |
| `filingPeriodKey`, `payrollPeriodKey` | 부가세 신고 기간과 급여 귀속월 연결 |
| `itemType` | `vat` / `withholding` / `social_insurance` |
| `sourceModule`, `sourceRefId` | 선행 산출물(`vat_period_summary`, `payroll_period_summary`) 추적 |
| `title`, `description` | 화면 표시 스냅샷 |
| `status` | `locked` / `ready` / `needs_review` / `submitted` |
| `packageStatus` | `locked` / `ready` / `generated` / `submitted` |
| `lockReason` | 잠금 사유(부가세 공제 검토, 급여 미마감 등) |
| `packageStorageKey`, `generatedAt` | 내부 패키지 저장 상태(private key는 UI 미노출) |
| `submittedAt` | 회사가 직접 제출했다고 기록한 시각 |
| `createdAt`, `updatedAt` | 감사·동기화 |

`filing_receipt`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId`, `filingItemId` | 범위와 신고 항목 연결 |
| `receiptType` | `hometax_receipt` / `payment_receipt` / `insurance_receipt` |
| `originalFilename`, `storageKey`, `fileHash` | 원본 추적(private storage key는 UI 미노출) |
| `uploadedByStaffId`, `uploadedAt` | 사용자 업로드 감사 |
| `createdAt`, `updatedAt` | 감사·동기화 |

`filing_checklist_item`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId`, `filingPeriodKey` | 범위 |
| `filingItemId` | 특정 신고 항목 연결(공통 항목은 null 허용) |
| `code`, `label`, `description`, `sortOrder` | 체크리스트 정의 |
| `completed`, `completedByStaffId`, `completedAt` | 완료 상태 |
| `createdAt`, `updatedAt` | 감사·동기화 |

## 5. Derivation Rules

- 모든 쿼리와 mutation은 `tenantId` + `businessEntityId`(`clientId`) + 기간 키로 제한한다.
- 부가세 항목은 `vat_period_summary.pendingDeductionCount > 0`이면 `locked`이며, CTA는 "패키지 · 잠김"이다.
- 부가세 `pendingDeductionCount = 0`이고 `packageStatus`가 `ready` 또는 `generated`이면 패키지 열기/생성이 가능하다.
- 원천세 항목은 `payroll_period_summary.withholdingStatementStatus`가 `ready` 또는 `generated`이고 `closeStatus='closed'`이면 `ready`다.
- 원천세 홈택스 입력 가이드는 급여 summary에서 `employeeCount`, `grossPayKrw`, `withholdingTaxKrw`를 읽어 만든다.
- 4대보험 항목은 `insuranceStatementStatus`가 생성되지 않았거나 `noticeImportStatus!='matched'`이면 `needs_review`다.
- 접수증은 사용자가 직접 제출 후 업로드한 파일만 보관한다. 시스템이 홈택스/EDI 제출 여부를 자동 확인하지 않는다.
- private `storageKey`, Blob URL, 자격증명, 공동인증서 관련 값은 화면과 로그에 노출하지 않는다.
- 책임 경계 배너는 default/empty/error 상태 어디에서도 사라지면 안 된다.

## 6. Mutation and State

| 액션 | 허용 | API/모듈 |
|:---|:---:|:---|
| 패키지 상태 동기화 | O | `POST /api/filing/periods/[periodKey]/sync` 또는 read model upsert |
| 접수증 업로드 | O | `POST /api/filing/receipts` |
| 접수증 삭제 | O | `DELETE /api/filing/receipts/[receiptId]` |
| 체크리스트 완료 토글 | O | `PATCH /api/filing/checklist-items/[itemId]` |
| 가이드 값 복사 | O | 클라이언트 clipboard, DB mutation 없음 |
| 홈택스 신고서 제출 | X | v1 범위 밖 |
| 세금 납부/이체 | X | v1 범위 밖 |
| 홈택스/EDI 로그인·스크래핑 | X | v1 범위 밖 |

- mutation 성공 후 `router.refresh()`로 서버 read model을 다시 읽는다.
- 접수증 업로드는 Vercel Blob private storage를 사용하고, UI에는 안전한 파일명·제출일·보관 상태만 표시한다.
- 체크리스트는 제출/납부 완료를 대행하지 않고, 회사가 직접 수행한 후 내부 확인 상태만 기록한다.

## 7. State Coverage

| 상태 | 조건 | UI |
|:---|:---|:---|
| Default | 선행 산출물 일부 준비 | 책임 경계 배너, 신고 항목 3개, 입력 가이드, 접수증, 체크리스트 |
| Loading | Server Component 지연 | `loading.tsx` 스켈레톤 |
| Empty | VAT/payroll 산출물 없음 | "부가세·급여 먼저 확정" 안내와 선행 화면 CTA |
| Error | read model 실패 | `error.tsx` "신고 항목을 불러오지 못했습니다" + 다시 시도 |
| Permission denied | 미인증 또는 tenant 미소속 | `/sign-in` redirect 또는 접근 안내 |

## 8. Implementation Sequence

1. `lib/db/schema.ts`와 Drizzle migration에 `filing_item`, `filing_receipt`, `filing_checklist_item` 추가.
2. `lib/filing-support/summary.ts` read model과 순수 파생 함수 작성.
3. `lib/filing-support/summary.test.ts`로 상태 파생·책임 경계·tenant scope 단위 테스트.
4. `/dashboard/filing-support/page.tsx` Server Component와 빈 상태 작성.
5. `_components/filing-support-workspace.tsx`를 승인 Preview 4.6 순서로 구현.
6. 접수증 업로드/삭제, 체크리스트 토글, 패키지 상태 동기화 API 작성.
7. `loading.tsx`, `error.tsx` 작성.
8. Sidebar와 회사 홈 `ROUTES.filingSupport`를 전용 route로 재지정.
9. 정적 테스트로 자동 제출/납부/자격증명 저장 문구·API·import가 없는지 확인.
10. QA seed로 `/dashboard/filing-support?period=2026-H1` 브라우저 캡처를 승인 Preview와 대조.

## 9. Acceptance Criteria

1. 신고 항목(부가세/원천세/4대보험)이 선행 화면 산출물과 연동되어 상태와 함께 표시된다.
2. 부가세 패키지는 공제 검토 완료 전 잠금이며, 잠금 사유가 visible locknote와 `aria-disabled`로 노출된다.
3. 홈택스 단계별 입력 가이드가 원천세 확정 값(인원, 총지급액, 징수세액)을 표시하고 값 복사가 가능하다.
4. 제출 접수증을 업로드·보관하고 미제출 항목은 업로드 대기로 표시한다.
5. 사후 체크리스트로 납부·접수증 보관 확인 상태를 저장한다.
6. 자동 홈택스 제출·자동 납부·자격증명 서버 저장은 제공하지 않으며, 화면에 책임 경계가 반복 노출된다.
7. 로딩·빈·오류 상태가 구현된다.

## 10. Security and Privacy

- 모든 API는 `requireTenantSession` 이후 tenant + businessEntity scope로 제한한다.
- `storageKey`, Blob URL, 홈택스/EDI 자격증명, 공동인증서 관련 값은 클라이언트 렌더 결과에 포함하지 않는다.
- 접수증 파일명은 표시 가능하지만 원본 파일 URL은 직접 노출하지 않는다.
- 신고지원은 세무 신고 보조 도구이며, 제출·납부 완료 여부는 사용자 기록과 접수증 업로드에 근거한다.

## 11. Open Items

- 실제 PDF/ZIP 패키지 생성 포맷은 JC-013 구현 중 최소 산출물로 결정한다.
- 홈택스 입력 가이드는 원천세부터 v1으로 구현하고, 부가세 입력 가이드는 VAT package 상태가 generated가 된 뒤 확장한다.
- 실제 EDI/홈택스 접수증 파일 포맷별 파싱은 JC-014 env/fixture 준비 후 검증한다.

## 12. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - MVP 비범위(자동 제출 제외)
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 신고지원 흐름 4f
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 신고지원 컴포넌트/CTA
- **UI_Screens**: [Filing Support Prototype Review](../02_UI_Screens/07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) - 사용자 승인 기록
- **UI_Screens**: [HTML Preview](../02_UI_Screens/previews/05_filing_support.html) - 구현 계약
- **Technical_Specs**: [DB Schema](./03_DB_SCHEMA.md) - 신고지원 신규 테이블
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) - 신고지원 컴포넌트 계획
- **Technical_Specs**: [VAT Pre-Code Brief](./07_VAT_PRE_CODE_BRIEF.md) - 부가세 패키지 선행 산출물
- **Technical_Specs**: [Payroll Pre-Code Brief](./08_PAYROLL_PRE_CODE_BRIEF.md) - 원천세·4대보험 선행 산출물
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-013 Context Lock
- **QA_Validation**: [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md) - 구현 검증 시나리오
