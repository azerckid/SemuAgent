# Source Collection Pre-Code Technical Brief
> Created: 2026-07-01 23:55
> Last Updated: 2026-07-03

## 1. Scope

JC-009 자료수집 구현 직전 데이터·mutation·acceptance 계약이다. 승인된
`01_source_collection.html` 구조를 React/Next.js로 옮기되, JARYO-GIWA의 **회계사무소
직접 업로드(staff direct)** 자산을 회사 **내부 업로드** 흐름으로 재정렬한다.

자료수집은 JC-006 회사 홈 이후 **첫 mutation 워크스페이스**다. 파일 업로드 저장,
파싱/정규화 큐 등록, 재시도가 발생한다. 외부 고객 업로드 포털은 v1 UI에서
노출하지 않는다.

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | `/dashboard/direct-upload` 유지(Sidebar·회사 홈 CTA가 이미 연결). 물리 경로는 `app/(dashboard)/dashboard/direct-upload/` |
| Layout | 기존 `app/(dashboard)/layout.tsx` + Sidebar 재사용 |
| Read model | `lib/source-collection/summary.ts` 신규. Server Component에서 직접 호출 |
| Mutation API | 기존 `POST /api/staff-direct-upload`, Vercel Blob client upload, `lib/ai/analyze.ts`·`lib/ai/process.ts` 파이프라인 재사용 |
| Client UI | 승인 Preview 구조로 교체 완료. 현재 렌더링 책임은 `source-collection.tsx`가 갖고, legacy `staff-direct-upload-workspace.tsx`는 JC-004에서 삭제 |
| 기간 컨텍스트 | 회사 홈과 동일하게 URL `?period=` search param. `lib/company-home/summary.ts`의 `buildCompanyHomePeriod` 재사용 |

기존 GIWA `StaffDirectUploadWorkspace`는 세션 생성 폼·다중 고객사 선택·"담당자
직접 업로드" 문구 중심이었다. JC-009에서 이를 **수집 완결성 → 업로드 → 자료유형
타일 → 수집 상태 표 → 미수집·확인 필요** 순서의 회사용 화면으로 교체했고,
JC-004에서 legacy wrapper를 삭제했다.

## 3. JC-004 Slice (Upload Route Audit, JC-009 범위)

JC-004 전체 감사는 후속으로 두고, 자료수집 착수에 필요한 업로드 라우트·책임
경계만 이 문서에서 확정한다.

### 3.1 회사 자료수집 In-Scope

| 구분 | 경로·모듈 | JC-009 역할 |
|:---|:---|:---|
| 화면 | `app/(dashboard)/dashboard/direct-upload/page.tsx` | 자료수집 SSR 진입점 |
| UI | `source-collection.tsx` | Preview 구조로 교체 완료. legacy wrapper는 JC-004에서 삭제 |
| 세션 생성 | `POST /api/staff-direct-upload` | 내부 업로드 세션(`source='staff_direct'`) 생성 |
| 검증 | `lib/validations/staff-direct-upload.ts` | Zod 입력 검증(기간·사업장·표시명) |
| Blob 업로드 | `@vercel/blob/client` + 기존 파일 등록 API | 파일 저장 mutation |
| 파싱·정규화 | `lib/ai/analyze.ts`, `lib/ai/process.ts`, `lib/ai/extract.ts` | 업로드 후 분석 큐 |
| 비밀번호 파일 | `lib/upload/file-password.ts`, `components/upload/file-password-input` | 암호 보호 파일 처리 |
| Read model | `upload_session`, `upload_file`, `request_item_validation` | 집계·상태 표시 |

### 3.2 v1 Company UI Out-of-Scope (노출·링크 금지)

| 구분 | 경로·모듈 | 제외 사유 |
|:---|:---|:---|
| 외부 고객 포털 | `app/upload/[token]/page.tsx`, `UploadPortal` | 회사 셀프사용 v1 범위 밖. 코드 삭제는 JC-004 전체 감사 때 |
| 고객 제출 API | `app/api/upload/submit`, `purpose-request`, `declarations` | 외부 포털 전용 |
| 메일 요청 흐름 | `dashboard/clients/[id]/events`, `outbound_email` UI | 회계사무소 고객 요청. Sidebar에 없음 |
| 메일함 | `dashboard/emails` | GIWA 회계사무소 운영. 회사 홈·자료수집에서 링크하지 않음 |

### 3.3 용어·책임 경계

| GIWA 잔존 | JC-009 회사용 표기 | DB/코드 |
|:---|:---|:---|
| 고객사 | 사업장 | `client.id` → `businessEntityId` 개념 |
| 담당자 직접 업로드 | 회사 내부 업로드 | `upload_session.source = 'staff_direct'` 유지 |
| 메일 업로드 | v1 자료수집 UI에서 미노출 | `source = 'customer_upload'` 행은 집계에서 제외 |
| 세무사·회계법인 | 사용 금지 | 회사 대표·재무담당·운영자 문구 |

### 3.4 기술 부채(Open, 구현 중 허용)

- `POST /api/staff-direct-upload`는 호환을 위해 `client_request_event` 행을 함께
  생성한다. JC-009 UI에서는 "고객 요청"으로 노출하지 않는다. 이벤트 테이블
  의존 제거는 JC-004/JC-009 후속 chore.
- API 경로명 `staff-direct-upload`는 v1에서 유지. 회사용 alias API는 YAGNI로
  보류.

## 4. Data Contract

```ts
type SourceCollectionPeriodKey = CompanyHomePeriodKey // lib/company-home/summary.ts 재사용

type SourceCollectionFileStatus =
  | 'uploaded'
  | 'analyzing'
  | 'matched'
  | 'needs_review'
  | 'rejected'
  | 'failed'

type SourceCollectionSourceType =
  | 'tax_invoice'      // 세금계산서
  | 'bank_statement'   // 통장 거래내역
  | 'card_purchase'    // 카드 매입내역
  | 'receipt_other'    // 영수증·기타

type SourceCollectionSummary = {
  tenant: {
    id: string
    name: string
    timezone: string
  }
  businessEntity: {
    id: string
    name: string
  } | null
  period: CompanyHomePeriod // buildCompanyHomePeriod 재사용
  completeness: {
    collectedCount: number
    requiredCount: number
    missingCount: number
    progressPercent: number
  }
  sourceTypeTiles: Array<{
    id: SourceCollectionSourceType
    title: string
    collectedCount: number
    requiredCount: number
    statusLabel: string
    tone: 'ok' | 'warn' | 'muted' | 'info'
  }>
  importRows: Array<{
    id: string
    safeTitle: string           // storage key·원본 경로 미노출
    sourceType: SourceCollectionSourceType | 'unknown'
    progressPercent: number
    status: SourceCollectionFileStatus
    statusLabel: string
    uploadedAt: string
    rowCountLabel: string | null // 예: "312건 · 1.2MB" — 파싱 후에만
    href: string                 // 상세/재시도 대상
    canRetry: boolean
  }>
  missingItems: Array<{
    id: string
    title: string
    description: string
    tone: 'warn' | 'danger'
    href: string
    ctaLabel: '다시 업로드' | '정규화 확인'
  }>
}
```

`businessEntity.id`는 Drizzle `client.id`. JC-005 물리 rename 전까지 `clientId`
컬럼을 그대로 참조한다.

## 5. Query Sources

| UI 영역 | 데이터 소스 | 최소 필드 | 계산/상태 |
|:---|:---|:---|:---|
| 인증·조직 | Better Auth session, `tenant` | `activeOrganizationId`, timezone | 미인증 `/sign-in`, tenant 없으면 회사용 안내 |
| 사업장 | `client` | `id`, `name` | MVP tenant당 첫 사업장 1개. 없으면 빈 상태 |
| 기간 | URL `period`, `buildCompanyHomePeriod` | startMonth, endMonth | 회사 홈과 동일 기본값 |
| 수집 완결성 | `request_item_validation`, `upload_session` | validationStatus, reviewStatus | missing/non_compliant/uncertain & reviewStatus!='excluded' |
| 자료유형 타일 | `request_item_validation.itemGroup`, `upload_file` | item_group, file status | 유형별 충족/미충족 집계 |
| 수집 상태 표 | `upload_file`, `upload_session` | status, fileType, fileSize, uploadedAt | `source='staff_direct'`, 기간 필터, staffReviewStatus!='excluded' |
| 미수집·확인 필요 | `request_item_validation`, failed/needs_review files | itemName, validationStatus, requestedAction | danger(파싱 실패), warn(미수집·저신뢰 정규화) |
| 파싱 진행 | `upload_file.status`, `analysis_run`(간접) | analyzing/matched/failed | progressPercent 파생 |

### 5.1 명시적 제외(회사 홈과 동일 + 자료수집 추가)

Read model·화면에서 읽지 않거나 링크하지 않는다.

- `request_template`, `client_request_schedule` — GIWA 요청 템플릿
- `outbound_email`, `inbound_email`, `staff_mailbox` — 메일 중심 흐름
- `customer_upload` 소스 세션 — 회사 내부 업로드 UI 집계에서 제외

`client_request_event`는 기존 API가 세션 생성 시 쓰는 **내부 브리지**일 뿐,
자료수집 read model의 1차 소스가 아니다.

## 6. Derivation Rules

- 모든 쿼리는 `tenantId`와 `businessEntityId`(`clientId`)를 함께 제한한다.
- 기간 필터는 `period.startMonth <= upload_session.accountingPeriod <= period.endMonth`.
- `upload_session.source = 'staff_direct'`만 자료수집 집계에 포함한다.
- `upload_file.staffReviewStatus = 'excluded'` 행은 집계·표에서 제외한다.
- 수집 완결성 `progressPercent = clamp((requiredCount - missingCount) / max(1, requiredCount) * 100)`.
- 미수집 건수는 회사 홈과 동일: `validationStatus in ('missing','non_compliant','uncertain')` &
  `reviewStatus != 'excluded'`.
- 파일 표시 제목은 `originalFilename` 대신 **안전한 표시명**을 쓴다.
  `lib/upload/file-display.ts`의 `resolveUploadedFileDisplay` 재사용. storage key·blob URL 미노출.
- 파싱 오류: `upload_file.status = 'failed'` 또는 `needs_review` + validation 연계.
  `canRetry=true`이면 CTA "다시 시도".
- 자료유형 매핑(초안): `item_group` / AI 분류 결과 → `SourceCollectionSourceType`.
  매핑 불가 시 `unknown`, 타일은 "기타"로 합산.
- 지원 형식(서버 정본 `ALLOWED_CONTENT_TYPES`): PDF, XLSX, XLS, 이미지(JPEG/PNG/WebP), ≤50MB.
  CSV·ZIP은 서버가 거부한다. 클라이언트 `accept`·안내 문구도 서버와 일치시킨다(JC-043 CUI-3 정합).
  CSV·ZIP 실지원은 별도 에픽(서버 허용 + 파서) 전까지 보류.

## 7. Mutation and State

| 항목 | 방침 |
|:---|:---|
| DB mutation | 업로드 세션 생성, 파일 메타 저장, 파싱 큐 등록, 재시도, 비밀번호 제출, 정규화 확인(후속 세부) |
| URL mutation | `?period=` 변경만. 기간은 DB에 저장하지 않음 |
| Loading | `loading.tsx` 스켈레톤(Completeness·Dropzone·Table 골격) |
| Empty | 사업장 없음 / 업로드 0건 / 필수 자료 템플릿 없음 각각 분리 |
| Error | "파일을 처리하지 못했습니다" + 다시 시도. 행 단위 danger는 표 내 표시 |
| Permission | tenant·staff 레코드 필요(기존 API 호환). 회계법인 문구 금지 |
| Toast | 업로드 진행·완료·실패는 `sonner`. 전역 상태 매니저 없음 |

### 7.1 Mutation 경계(회사 홈 대비)

| 액션 | 허용 | API/모듈 |
|:---|:---:|:---|
| 파일 업로드·저장 | O | Blob client + 파일 등록 |
| 세션 생성 | O | `POST /api/staff-direct-upload` |
| 파싱/정규화 큐 | O | `lib/ai/process.ts` |
| 파싱 재시도 | O | 기존 analyze 재호출 경로 |
| 정규화 확정·재분류 | O(초기) | 기장검토 연계 전 최소 재시도·확인 CTA |
| 기장 승인·전표 확정 | X | JC-010 |
| 외부 포털 링크 생성·발송 | X | v1 제외 |

## 8. GIWA Gap (현재 구현 vs 승인 Preview)

| Preview 섹션 | 현재 `direct-upload` | JC-009 구현 방향 |
|:---|:---|:---|
| 수집 완결성 Header | 없음 | `completeness` read model 추가 |
| Upload Dropzone | 세션 내 파일 선택 | 기간·사업장 컨텍스트 상단 고정 드롭존 |
| Source Type Tile | 없음 | `sourceTypeTiles` 4종 |
| 수집(가져오기) 상태 표 | 업로드 파일 리스트(세션 한정) | 기간 내 전체 `importRows` 표 |
| 미수집·확인 필요 | 없음 | `missingItems` + CTA |
| 다중 고객사 선택 | 있음 | MVP 첫 사업장 자동. 다사업장은 JC-005 후속 |
| 작업 유형(bookkeeping/vat/…) | 명시 선택 | 파일·자료유형 중심. 급여 전용은 `/dashboard/payroll` 유지 |
| 화면 상태 예시 | 없음 | Preview와 동일 State Card 섹션 |

## 9. Implementation Sequence

1. `lib/source-collection/summary.ts` read model + 순수 파생 함수.
2. `lib/source-collection/summary.test.ts` — 완결성·기간 필터·파일 상태·제외 소스.
3. `direct-upload/page.tsx`를 read model 기반 SSR로 정리.
4. `source-collection.tsx` UI — Preview 4.2 컴포넌트 순서 구현.
5. legacy `staff-direct-upload-workspace.tsx` wrapper 삭제(JC-004). 업로드 mutation은 `SourceCollectionView`에서 유지·위임.
6. `loading.tsx` / `error.tsx` 경계 추가.
7. JC-004 슬라이스: Sidebar·화면에서 외부 포털·메일 요청 링크 없음 정적 검증.

## 10. Acceptance Criteria

- `/dashboard/direct-upload`가 승인 Preview 구조(완결성 → 업로드 → 타일 → 표 → 미수집)를 따른다.
- 회사 내부 사용자가 PDF/XLSX/XLS/이미지(≤50MB)을 업로드하면 저장 후 파싱 큐에 등록된다.
- 자료유형별 집계·정규화 상태가 타일과 표에 표시된다.
- 파싱 오류 건은 danger 상태 + "다시 시도" CTA가 있다.
- 수집 완결성(미수집 건수)과 미수집·확인 필요 목록이 표시된다.
- 외부 고객 업로드 포털 링크·문구가 자료수집 UI에 없다.
- 로딩·빈·오류 상태가 각각 구현된다.
- 모든 데이터·mutation은 `tenantId`·`businessEntityId` 범위를 벗어나지 않는다.
- `customer_upload` 소스·메일 요청 UI를 자료수집에서 노출하지 않는다.

## 11. Open Items

- Layer 5 QA: [03_SOURCE_COLLECTION_TEST_SCENARIOS.md](../05_QA_Validation/03_SOURCE_COLLECTION_TEST_SCENARIOS.md).
- `client_request_event` 브리지 제거·세션 생성 API 회사용 rename — JC-004 후속 chore.
- 다사업장 선택 UI — JC-005 `business_entity` 확정 후.
- 정규화 확정 mutation 상세 — 기장검토(JC-010)와 경계 조율.
- ZIP·CSV MIME 확장 — **보류**. 현재는 서버 미지원이며 클라이언트 표기를 서버에 맞춤(JC-043 CUI-3).

## 12. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용 책임 경계
- **UI_Screens**: [Screen Flow 4b](../02_UI_Screens/00_SCREEN_FLOW.md) - 자료수집 입출력·mutation
- **UI_Screens**: [UI Design 4.2](../02_UI_Screens/01_UI_DESIGN.md) - 컴포넌트 구조
- **UI_Screens**: [Source Collection Review](../02_UI_Screens/03_SOURCE_COLLECTION_PROTOTYPE_REVIEW.md) - 사용자 확인 기록
- **UI_Screens**: [HTML Preview](../02_UI_Screens/previews/01_source_collection.html) - 승인된 화면 기준
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) - 7.2 자료수집 매핑
- **Technical_Specs**: [Company Home Pre-Code Brief](./04_COMPANY_HOME_PRE_CODE_BRIEF.md) - 기간·tenant 패턴
- **Technical_Specs**: [DB Schema](./03_DB_SCHEMA.md) - upload 테이블 매핑
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-009 Context Lock
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) - 공통 릴리스 기준
