# Payroll Pre-Code Technical Brief
> Created: 2026-07-02 14:21
> Last Updated: 2026-07-02 14:34

## 0. Governing Principle - Preview UI가 계약이다

JC-012 급여 화면은 승인된 [04_payroll.html](../02_UI_Screens/previews/04_payroll.html)
구조를 실제 제품 화면으로 옮긴다. 기존 GIWA 급여 추출 기능을 그대로 노출하는 것이 아니라,
Preview의 업무 흐름을 데이터 계약으로 삼는다.

- 보이는 UI는 회사용 `/dashboard/payroll` 화면으로 새로 구성한다.
- GIWA 사업장 상세의 급여 규칙 관리 패널이나 외부 업로드 포털을 급여 화면에 import/render/embed하지 않는다.
- 기존 `payroll_extraction_*`, 급여 규칙 프로필, 급여 Excel draft 서비스는 재사용하되, 화면은 승인 Preview 4.5 흐름에 맞춰 재배치한다.
- 급여 공제 중 4대보험은 요율 계산값만으로 확정하지 않는다. 건강보험 EDI/사회보험 고지내역을 업로드 또는 수동 입력으로 가져와 직원별 고지액과 매칭하고, 최종 급여정산에는 고지액을 우선 반영한다.
- EDI/포털 자동 로그인, 자동 스크래핑, 공동인증서/자격증명 저장은 v1 범위 밖이다.
- 확인 필요 직원이 있으면 급여 마감·확정 버튼은 잠금 상태여야 한다.

## 1. Scope

JC-012 급여 구현 직전 계약. 자료수집에서 업로드된 급여 자료, 기존 급여 추출 파이프라인, 그리고 4대보험 고지내역을 바탕으로 다음 화면 단위를 제공한다.

1. 지급총액 - 공제총액 = 실지급액 요약
2. 확인 필요 직원 알림
3. 급여대장(직원별 지급/공제/실지급)
4. 공제 상세(소득세·지방소득세·국민연금·건강보험·장기요양·고용보험)
5. 급여명세서·지급명세서 미리보기
6. 급여 마감·확정 잠금
7. 로딩, 빈 상태, 오류 상태

JC-012 구현은 기존 `payroll_extraction_row`를 원천 후보로 재사용하되, Preview의 집계·마감·고지액 매칭을 안정적으로 표현하기 위해 급여 실행 결과 테이블을 추가한다.

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | 신규 `/dashboard/payroll`, 물리 경로 `app/(dashboard)/dashboard/payroll/` |
| 사이드바·홈 CTA | Sidebar "급여"는 `/dashboard/payroll`로 유지. 회사 홈 급여 카드도 구현 후 전용 route로 이동 |
| Read model | `lib/payroll-workspace/summary.ts` 신규. Server Component에서 호출 |
| Persistence | 기존 `payroll_extraction_*` 재사용 + `payroll_period_summary`, `payroll_employee_line`, `payroll_insurance_notice_import`, `payroll_insurance_notice_line` 신규 |
| Mutation API | 직원 line 수정/확인, 고지내역 import 매칭, 명세서 생성, 급여 마감 API 신규 |
| Client UI | `_components/payroll-workspace.tsx` 신규. Preview 4.5 구조 |
| 기간 컨텍스트 | URL `?period=YYYY-MM`, 기본값은 현재 귀속월 |
| EDI boundary | 건강보험 EDI/사회보험 고지내역은 파일 업로드 또는 수동 입력으로만 반영. 자동 로그인·스크래핑 없음 |
| Filing boundary | 원천징수 지급명세서·4대보험 자료는 JC-013 신고지원으로 전달. 자동 제출 없음 |

## 3. Data Contract

```ts
type PayrollTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info'
type PayrollCloseStatus = 'open' | 'blocked' | 'closed'
type PayrollLineStatus = 'ready' | 'needs_review' | 'closed'
type PayrollNoticeMatchStatus = 'matched' | 'missing_notice' | 'ambiguous' | 'unmatched'

type PayrollWorkspaceSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: {
    key: string
    payrollMonth: string
    paymentDate: string | null
    label: string
  }
  summary: {
    employeeCount: number
    grossPayKrw: number
    withholdingTaxKrw: number
    socialInsuranceKrw: number
    deductionTotalKrw: number
    netPayKrw: number
    issueCount: number
    closeStatus: PayrollCloseStatus
  }
  issueAlert: {
    visible: boolean
    title: string
    description: string
    targetEmployeeLineId: string | null
  }
  registerRows: Array<{
    id: string
    employeeCode: string | null
    employeeName: string
    displayName: string
    department: string | null
    baseSalaryKrw: number
    allowanceKrw: number
    grossPayKrw: number
    incomeTaxKrw: number
    localIncomeTaxKrw: number
    nationalPensionKrw: number
    healthInsuranceKrw: number
    longTermCareKrw: number
    employmentInsuranceKrw: number
    socialInsuranceKrw: number
    deductionTotalKrw: number
    netPayKrw: number
    status: PayrollLineStatus
    issueLabel: string | null
    noticeMatchStatus: PayrollNoticeMatchStatus
  }>
  deductionBreakdown: Array<{
    id: 'income_tax' | 'local_income_tax' | 'national_pension' | 'health_insurance' | 'long_term_care' | 'employment_insurance'
    label: string
    amountKrw: number
    source: 'calculated' | 'notice' | 'manual'
    tone: PayrollTone
  }>
  documents: Array<{
    id: 'payslip' | 'withholding_statement' | 'insurance_statement'
    title: string
    description: string
    statusLabel: string
    tone: PayrollTone
  }>
  closeAction: {
    locked: boolean
    lockReason: string | null
    canClose: boolean
  }
}
```

## 4. Query Sources

| UI 영역 | 데이터 소스 | 최소 필드 | 계산/상태 |
|:---|:---|:---|:---|
| 인증·조직·사업장 | Better Auth session, `tenant`, `client` | tenantId, businessEntityId, role | 미인증 `/sign-in`, 사업장 없으면 빈 상태 |
| 기간 | URL `period=YYYY-MM` | payrollMonth, paymentDate | 급여 귀속월 기준 |
| 급여 원천 후보 | `payroll_extraction_batch`, `payroll_extraction_row`, `upload_session` | requestKind, status, payrollPeriod, employee fields, pay fields, aiVerdict, reviewStatus | 최신 completed/needs_review batch를 기간별로 사용 |
| 급여 실행 결과 | 신규 `payroll_period_summary`, `payroll_employee_line` | 지급·공제·실지급·상태·마감 | 화면 source of truth |
| 급여 규칙 | `client_payroll_rule_profile`, `payroll_rule_profile_application` | active profile, applied snapshot | 계산 기준 표시·재계산 근거 |
| 4대보험 고지 | 신규 `payroll_insurance_notice_import`, `payroll_insurance_notice_line` | sourceType, notice month, employee match key, 고지액 | 고지액이 있으면 최종 공제액 우선 |
| 급여명세서 초안 | `payroll_excel_draft`, `lib/payroll/wage-statement-draft.ts` | generated/failed, filename, rows | 미리보기·생성 상태 |

### 4.1 신규 테이블 최소 논리 컬럼

`payroll_period_summary`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId` | tenant + businessEntity 범위 |
| `payrollPeriod`, `paymentDate` | 귀속월·지급일 |
| `employeeCount`, `issueCount` | 직원 수·확인 필요 건수 |
| `grossPayKrw`, `withholdingTaxKrw`, `socialInsuranceKrw`, `deductionTotalKrw`, `netPayKrw` | 요약 금액 |
| `noticeImportStatus` | 4대보험 고지내역 상태(`missing`/`partial`/`matched`) |
| `closeStatus`, `closedByStaffId`, `closedAt` | 마감 상태 |
| `payslipStatus`, `withholdingStatementStatus`, `insuranceStatementStatus` | 문서 생성 상태 |
| `createdAt`, `updatedAt` | 감사·동기화 |

`payroll_employee_line`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId`, `periodSummaryId` | 범위 |
| `sourceBatchId`, `sourceRowId`, `uploadSessionId` | 급여 추출 원천 추적 |
| `employeeCode`, `employeeName`, `department`, `jobTitle`, `jobType` | 화면 표시 최소 직원 정보 |
| `baseSalaryKrw`, `allowanceKrw`, `grossPayKrw` | 지급 |
| `incomeTaxKrw`, `localIncomeTaxKrw` | 원천세 |
| `nationalPensionKrw`, `healthInsuranceKrw`, `longTermCareKrw`, `employmentInsuranceKrw` | 4대보험 근로자 부담액 |
| `socialInsuranceKrw`, `deductionTotalKrw`, `netPayKrw` | 공제·실지급 파생 저장 |
| `noticeMatchStatus`, `noticeLineId` | 고지액 매칭 |
| `status`, `issueCode`, `issueMessage` | 확인 필요/준비/마감 |
| `editedByStaffId`, `editedAt`, `createdAt`, `updatedAt` | 감사·동기화 |

`payroll_insurance_notice_import`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId`, `payrollPeriod` | 범위 |
| `sourceType` | `nhis_edi` / `social_insurance_portal` / `manual` |
| `originalFilename`, `storageKey`, `fileHash` | 업로드 원본 추적. private key는 UI 미노출 |
| `status`, `importedByStaffId`, `importedAt` | 처리 상태 |

`payroll_insurance_notice_line`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId`, `noticeImportId` | 범위 |
| `employeeCode`, `employeeName`, `matchKeyHash` | 직원 매칭. 주민등록번호 원문 저장 금지 |
| `nationalPensionKrw`, `healthInsuranceKrw`, `longTermCareKrw`, `employmentInsuranceKrw` | 고지된 직원 부담액 |
| `matchStatus`, `matchedEmployeeLineId` | 매칭 결과 |
| `createdAt`, `updatedAt` | 감사·동기화 |

## 5. Derivation Rules

- 모든 쿼리와 mutation은 `tenantId` + `businessEntityId`(`clientId`) + `payrollPeriod`로 제한한다.
- 화면 금액은 하드코딩하지 않고 행별 파생값의 합으로 만든다.
- `grossPayKrw = baseSalaryKrw + allowanceKrw`.
- `withholdingTaxKrw = incomeTaxKrw + localIncomeTaxKrw`.
- `socialInsuranceKrw = nationalPensionKrw + healthInsuranceKrw + longTermCareKrw + employmentInsuranceKrw`.
- `deductionTotalKrw = withholdingTaxKrw + socialInsuranceKrw + otherDeductionKrw`.
- `netPayKrw = grossPayKrw - deductionTotalKrw`.
- 고지액이 매칭된 4대보험 항목은 계산 추정값보다 우선한다. 고지액이 없거나 매칭이 모호하면 해당 직원은 `needs_review`로 남기고 마감 잠금 사유에 포함한다.
- Preview 기준 수치 재현: 지급총액 42,600,000원, 공제총액 5,840,000원, 실지급 36,760,000원, 확인 필요 1건.
- 개인정보: 주민등록번호, 전화번호, 계좌번호, raw storage key는 화면과 QA seed에 노출하지 않는다. 직원명은 권한 있는 회사 운영자에게만 표시하고, 권한이 부족하면 마스킹된 `displayName`을 사용한다.
- 급여가 `closed`가 되면 line 수정과 고지액 재매칭은 잠그고, 재오픈은 후속 범위로 둔다.

## 6. Insurance Notice Priority Policy

급여의 4대보험 공제는 "계산 추정값"과 "공식 고지액"을 분리한다.

| 구분 | 제품 내 의미 | 급여정산 반영 |
|:---|:---|:---|
| 급여 계산값 | 급여액·요율·취득 기준으로 만든 예상치/초안 | 고지액이 없을 때 임시값 또는 차이 비교용 |
| 건강보험 EDI/사회보험징수포털 고지내역 | 사업장 단위로 조회·수신한 공식 고지 보험료 | 최종 급여정산의 4대보험 공제 기준 |
| 최종 급여정산값 | 고지액 우선 반영 + 계산값과의 차이 사유 표시 | 급여대장·명세서·신고지원 산출물의 기준 |

고지액을 우선하는 이유:

- 보수월액 변경이 반영될 수 있다.
- 입사·퇴사에 따른 일할 계산 또는 소급 반영이 섞일 수 있다.
- 건강보험 연말정산 보험료가 포함될 수 있다.
- 장기요양보험료가 건강보험료와 함께 고지된다.
- 감면·정산·추징·환급이 포함될 수 있다.
- 전월 신고 반영 지연분이 다음 고지에 반영될 수 있다.

MVP 흐름:

1. 급여대장 초안을 생성한다.
2. 사용자가 건강보험 EDI/사회보험징수포털에서 받은 고지내역을 업로드하거나 수동 입력한다.
3. 직원별 건강보험·장기요양 등 고지액을 매칭한다.
4. 계산 공제액과 고지액의 차이를 표시한다.
5. 최종 급여정산에는 고지액을 반영한다.
6. 신고지원에서는 건강보험 EDI 확인·접수증 보관 흐름으로 연결한다.

자동 로그인·자동 스크래핑·자동 제출·공동인증서/자격증명 저장은 v1에서 제공하지 않는다.

## 7. Mutation and State

| 액션 | 허용 | API/모듈 |
|:---|:---:|:---|
| 직원 급여 line 수정 | O | `PATCH /api/payroll/employee-lines/[lineId]` |
| 확인 필요 처리 | O | `POST /api/payroll/employee-lines/[lineId]/resolve` |
| 4대보험 고지내역 업로드/수동 등록 | O | `POST /api/payroll/periods/[period]/insurance-notices` |
| 고지액 매칭 재시도 | O | `POST /api/payroll/periods/[period]/insurance-notices/match` |
| 급여명세서·지급명세서 생성 | O | `POST /api/payroll/periods/[period]/documents` |
| 급여 마감·확정 | O(잠금 해제 후) | `POST /api/payroll/periods/[period]/close` |
| EDI 자동 로그인·스크래핑 | X | v1 범위 밖 |
| 홈택스/EDI 자동 제출 | X | JC-013에서도 비범위 |

- mutation 성공 후 Server Component를 refresh/revalidate한다.
- 확인 필요가 있으면 close API는 409를 반환한다.
- Loading: `loading.tsx` 스켈레톤.
- Empty: 해당 월 급여 line이 없으면 "급여 자료 불러오기".
- Error: "급여 계산을 불러오지 못했습니다" + 다시 시도.
- Toast: 직원 수정, 고지액 import/match, 문서 생성, 마감 성공/실패는 `sonner`.

## 8. GIWA Gap

| Preview 섹션 | 현재 코드 | JC-012 방향 |
|:---|:---|:---|
| 급여 요약 Hero | 회사 홈의 대기 카드만 존재 | `/dashboard/payroll` 전용 read model |
| 급여대장 | `payroll_extraction_row` 후보 데이터 존재 | `payroll_employee_line`으로 실행 결과 스냅샷 |
| 공제 상세 | Zod 추출 타입에는 항목 존재, DB에는 상세 공제 컬럼 부족 | 신규 line에 원천세·4대보험 상세 저장 |
| 4대보험 고지액 | 전용 저장소 없음 | EDI/사회보험 고지내역 import + line 매칭 |
| 명세서 | `wage-statement-draft`, `payroll_excel_draft` 일부 존재 | Preview 문서 리스트와 생성 상태로 연결 |
| 마감 | 전용 상태 없음 | `payroll_period_summary.closeStatus` |
| 외부 세무사/고객 포털 | 기존 GIWA 경로 존재 | 회사용 화면에는 노출하지 않음 |

## 9. Implementation Sequence

1. Drizzle schema + migration: `payroll_period_summary`, `payroll_employee_line`, `payroll_insurance_notice_import`, `payroll_insurance_notice_line`.
2. `lib/payroll-workspace/summary.ts` read model + 순수 파생 함수(금액 합계, 고지액 우선순위, 마감 잠금, 마스킹).
3. `lib/payroll-workspace/summary.test.ts` - 산식·고지액 매칭·마감 잠금·PII 마스킹·tenant 범위.
4. `/dashboard/payroll/page.tsx` SSR + 사업장/급여 없음 빈 상태.
5. `_components/payroll-workspace.tsx` - Preview 4.5 구조(요약 -> 확인 필요 -> 급여대장 -> 공제 상세 -> 명세서·마감).
6. 직원 line 수정/확인 필요 처리 mutation API + UI 배선.
7. 4대보험 고지내역 import/match API + UI 배선.
8. 명세서 생성/급여 마감 guard API + locked button wrapper.
9. `loading.tsx`/`error.tsx`.
10. Sidebar·회사 홈 `ROUTES.payroll` 정합 + GIWA 급여 규칙 패널 미import 정적 테스트.
11. 로컬 QA seed로 Preview 숫자(42,600,000 - 5,840,000 = 36,760,000, 확인 필요 1건)를 재현하고 브라우저 캡처 비교.

## 10. Acceptance Criteria

- `/dashboard/payroll`가 승인 Preview 구조(급여 요약 -> 확인 필요 -> 급여대장 -> 공제 상세 -> 명세서·마감)를 따른다.
- 급여대장이 직원별 기본급·수당·지급계·원천세·4대보험·공제계·실지급을 표시한다.
- 금액은 파생 계산으로 정합한다: 지급계=기본급+수당, 공제계=원천세+4대보험, 실지급=지급계-공제계, 합계=각 열의 합.
- 건강보험 EDI/사회보험 고지액이 있으면 4대보험 최종 공제액에 우선 반영하고, 계산값과 차이가 있으면 확인 필요 또는 조정 사유로 표시한다.
- 확인 필요 직원이 있으면 급여 마감·확정 버튼은 disabled + `aria-disabled` + visible locknote로 잠긴다.
- 급여명세서·지급명세서 생성 상태가 표시되고, 원천징수 지급명세서/4대보험 산출물은 신고지원으로 전달 가능해야 한다.
- 주민등록번호·계좌번호·전화번호·storage key는 화면에 노출하지 않는다.
- 자동 EDI/홈택스 제출, 공동인증서 저장, 외부 세무사 검토 흐름은 화면에 없다.
- 모든 데이터·mutation은 `tenantId`·`businessEntityId` 범위를 벗어나지 않는다.
- 로딩·빈·오류 상태가 각각 구현된다.

## 11. Open Items

- 실제 EDI/사회보험 고지내역 파일 포맷 파서는 구현 단계에서 최소 CSV/XLSX 업로드로 시작한다. 포털별 자동 다운로드는 v1 제외.
- 국민연금·고용보험 고지액이 건강보험 EDI 파일에 없을 수 있으므로, 고지 출처별 필드 부재를 `missing_notice`로 표현한다.
- 급여 마감 후 재오픈·정정 급여는 후속 범위다.
- 임금명세서 실제 교부/발송은 후속 범위다. v1은 미리보기와 내부 산출물 생성까지.
- JC-005 물리 rename(`client` -> `business_entity`) 시 payroll 신규 테이블 FK 명칭도 함께 정리한다.

## 12. External References

- [국민건강보험 EDI](https://edi.nhis.or.kr/homeapp/wep/m/retrieveMain.xx) - 사업장 공동인증서 기반 EDI, 보험료 고지내역서 서식 확인
- [사회보험 통합징수 포털](https://si4n.nhis.or.kr/) - 사회보험료 고지/납부 관련 포털

## 13. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 직접 사용 및 제출 보조 책임 경계
- **UI_Screens**: [Screen Flow 4e](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.5](../02_UI_Screens/01_UI_DESIGN.md) · [Payroll Prototype Review](../02_UI_Screens/06_PAYROLL_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/04_payroll.html)
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) · [DB Schema](./03_DB_SCHEMA.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-012 Context Lock
- **QA_Validation**: [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md) - 구현 전 QA 계약
