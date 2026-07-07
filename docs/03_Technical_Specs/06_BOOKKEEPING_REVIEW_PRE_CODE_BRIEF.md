# Bookkeeping Review Pre-Code Technical Brief
> Created: 2026-07-02 09:00
> Last Updated: 2026-07-08 00:45

## 0. Governing Principle — Preview UI가 계약이다

JC-010의 회사 기장검토 분류 큐는 승인된 [02_bookkeeping_review.html](../02_UI_Screens/previews/02_bookkeeping_review.html) 구조를 그대로 따른다. 2026-07-08 승인된 [12_reconciliation_ledger.html](../02_UI_Screens/previews/12_reconciliation_ledger.html)은 Path 1 자료대조원장 전용 Preview이며, 별도 구현 Brief가 필요하다. 아래 두 규칙을 강제한다(정적 테스트로 검증):

- **보이는 UI는 회사용으로 새로 만든다.** GIWA `/dashboard/reviews` 워크스페이스 컴포넌트를
  회사 기장검토 화면에서 import/render/embed하지 않는다. (자료수집에서 세션 폼이 새어든 실수 반복 금지)
- **재사용은 데이터·서비스 레이어에서만.** read model 쿼리 + 기존 분류/승인 mutation API 호출.

## 1. Scope

JC-010 회사 기장검토 분류 큐 구현 계약. 정규화된 거래의 **계정과목 분류 큐**를 렌더하고, AI 추천·신뢰도 표시, 개별/일괄 승인, 선택 거래 분개 미리보기를 제공한다.

GIWA `bookkeeping_transaction_classification` 스키마가 Preview와 정확히 대응한다:
`recommendedAccount`(AI 추천) · `recommendationConfidence`(high/medium/low = 신뢰도 바) ·
`finalAccount`(계정 지정) · `status`(suggested/needs_decision/confirmed/unclassified/excluded).

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | **신규 `/dashboard/bookkeeping`** (회사 분류 큐). 물리 경로 `app/(dashboard)/dashboard/bookkeeping/` |
| 사이드바·링크 | `ROUTES.bookkeeping`(`lib/company-home/summary.ts`)은 `/dashboard/bookkeeping` 기장검토 분류 큐로 연결한다. 자료대조원장 전용 하위 라우트는 12번 Preview 후속 Brief에서 확정한다. |
| GIWA reviews | `/dashboard/reviews`는 **내부 심화 도구로 유지**(회사 내비에서 링크하지 않음). 회사 화면에서 embed 금지 |
| Read model | `lib/bookkeeping-review/summary.ts` 신규. Server Component에서 호출 |
| Mutation | 기존 세션 API 재사용: 개별 `PATCH /api/sessions/[id]/account-classification/rows/[rowId]`, 일괄 `POST /api/sessions/[id]/account-classification/bulk-confirm` |
| Client UI | `_components/bookkeeping-review.tsx` 신규. Preview 4.3 구조 |
| 기간 컨텍스트 | URL `?period=`, `buildCompanyHomePeriod` 재사용 |

## 3. Data Contract

```ts
type BookkeepingReviewConfidence = 'high' | 'medium' | 'low'
type BookkeepingReviewRowStatus = 'suggested' | 'needs_decision' | 'confirmed' | 'unclassified' | 'excluded'
type BookkeepingReviewTab = 'pending' | 'low_confidence' | 'confirmed' | 'all'

type BookkeepingReviewQueueRow = {
  id: string
  uploadSessionId: string        // 세션 단위 mutation API 호출에 필요
  transactionDate: string | null
  description: string            // merchantName/description (거래 데이터, 파일명 아님 — 표시 허용)
  counterparty: string | null
  amountKrw: number | null
  recommendedAccount: string | null
  finalAccount: string | null
  confidence: BookkeepingReviewConfidence
  status: BookkeepingReviewRowStatus
  requiresManualAccount: boolean // 신뢰도 low & 미확정 → "계정 지정" 강제
}

type BookkeepingReviewSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: CompanyHomePeriod
  counts: { pending: number; lowConfidence: number; confirmed: number; total: number }
  rows: BookkeepingReviewQueueRow[]           // 선택 탭 기준
  selected: {
    row: BookkeepingReviewQueueRow
    journalEntry: {
      lines: Array<{ side: '차변' | '대변'; account: string; amountKrw: number }>
      balanced: boolean
    } | null                                  // 전표 생성 전이면 null(잠금 표시)
    attribution: { periodLabel: string; evidenceType: string | null; vatDeductible: boolean | null }
  } | null
}
```

## 4. Query Sources

| UI 영역 | 데이터 소스 | 최소 필드 | 계산/상태 |
|:---|:---|:---|:---|
| 인증·조직·사업장 | session, `tenant`, `client` | 회사홈/자료수집과 동일 | 미인증 `/sign-in`, tenant/사업장 없으면 빈 상태 |
| 기간 | URL `period`, `buildCompanyHomePeriod` | startMonth·endMonth | 회사홈과 동일 |
| 분류 큐 | `bookkeeping_transaction_classification` ⨝ `upload_session`(scoped) | recommendedAccount, recommendationConfidence, finalAccount, status, transactionDate, merchantName, amountKrw, uploadSessionId | 최신 `classification_run` 기준, `source='staff_direct'`, 기간 필터 |
| 탭 카운트 | 위와 동일 | status, confidence | pending=suggested+needs_decision, low=low&미확정, confirmed=confirmed |
| 분개 미리보기 | `bookkeeping_journal_entry_voucher(_line)` | side, account, amount | 해당 거래 전표 있으면 표시, 없으면 "기장 확정 후 생성" 잠금 |
| 기간 귀속 | `bookkeeping_material_attribution` (있으면) | attributedPeriod, evidence | 참고 표시(읽기) |

### 4.1 명시적 제외(회사 홈과 동일 + 기장검토 추가)
- `request_template`·`outbound_email`·`inbound_email`·`staff_mailbox` 등 v1 제외 테이블 미참조
- adaptive structuring, material attribution 심화 편집, 세션 평가(session_evaluation)는 회사 UI 비노출 → 필요 시 내부 `/dashboard/reviews`

## 5. Derivation Rules

- 모든 쿼리는 `tenantId` + `businessEntityId`(`clientId`) + 기간으로 제한한다.
- 큐는 세션별 **최신 classification_run**의 행만 집계(오래된 run 제외).
- 신뢰도 바: `recommendationConfidence` high/medium/low → ok/warn/danger 톤.
- `requiresManualAccount = confidence==='low' && status!=='confirmed'` — 승인 전 "계정 지정" 강제.
- 거래 표시: `description`은 merchantName/description(거래 내용)으로, **파일명·storage key는 노출하지 않는다**.
- 분개 미리보기의 균형: 차변 합계 = 대변 합계 여부를 파생해 표시(하드코딩 금지).

## 6. Mutation and State

| 액션 | 허용 | API/모듈 |
|:---|:---:|:---|
| 개별 승인/수정(계정 확정) | O | `PATCH /api/sessions/[id]/account-classification/rows/[rowId]` { status:'confirmed', finalAccount } |
| 다중(일괄) 승인 | O | `POST /api/sessions/[id]/account-classification/bulk-confirm` { rowIds } — **세션 단위 API**. 아래 그룹 호출 규칙 참조 |
| 계정 지정(low) | O | 위 PATCH로 finalAccount 지정 후 확정 |
| 분류 run 시작/취소 | △ | 기존 start/cancel API 존재. 회사 UI에서 노출 여부는 구현 시 결정(기본: 자동/숨김) |
| 전표 생성·확정(journal entry) | X(v1) | 별도 run. 회사 자료대조원장 v1은 분류 확정까지, 전표 생성은 후속/내부 |
| adaptive structuring·material 심화 | X | 내부 `/dashboard/reviews` |

- 큐 행은 **여러 세션에 걸쳐** 집계된다. 승인 mutation API는 모두 **단일 세션(`/api/sessions/[id]/...`) 스코프**이며, `bulk-confirm`도 URL의 한 `sessionId` + 그 세션의 `rowIds`만 받는다(`classification-service.ts`의 `bulkConfirmBookkeepingRows`는 해당 세션 최신 run 기준).
- **Mixed-session bulk confirm 규칙**: 선택 행을 `uploadSessionId`별로 그룹핑 → 세션별로 `bulk-confirm`을 각각 호출 → 결과를 합산해 한 번의 성공/부분실패 토스트로 보고한다. 일부 세션 실패 시 성공 건수와 실패 세션을 구분해 표시한다.
- 개별 승인/수정도 해당 행의 `uploadSessionId`로 올바른 세션 API 경로를 사용한다.
- Loading/Empty/Error: `loading.tsx`/`error.tsx` + 빈 상태(사업장 없음 / 거래 없음 / 검토 대기 0건).
- 승인 성공/실패 피드백은 `sonner`. 목록 갱신은 서버 재검증.

## 7. GIWA Gap (현재 reviews 워크스페이스 vs 승인 Preview)

| Preview 섹션 | 현재 `/dashboard/reviews` | JC-010 방향 |
|:---|:---|:---|
| 분류 현황 헤더 | 세션별 상태 | 기간 단위 집계(확정/대기/진행률) |
| 탭(대기/신뢰도낮음/확정/전체) | 없음(세션 뷰) | `counts` 기반 탭 |
| 분류 큐 표(AI추천+신뢰도+승인) | account-classification 팝업/테이블 | 회사용 표로 재구현, mutation은 기존 API |
| 분개 미리보기 | review-journal-entry-preview | 회사용 카드로 재구현(읽기) |
| 다중 고객사·세션 선택 | 있음 | 회사=사업장 1개, 세션 선택 UI 없음 |
| adaptive/material/평가 | 있음 | 회사 UI 비노출(내부 도구) |

## 8. Implementation Sequence

1. `lib/bookkeeping-review/summary.ts` read model + 순수 파생 함수(탭 카운트, 신뢰도 톤, requiresManualAccount, 분개 균형).
2. `lib/bookkeeping-review/summary.test.ts` — 집계·탭·신뢰도·계정지정 강제·기간/스코프·제외 테이블.
3. `/dashboard/bookkeeping/page.tsx` read model 기반 SSR + 사업장/거래 없음 빈 상태.
4. `_components/bookkeeping-review.tsx` — Preview 4.3 구조(헤더→탭→큐 표→선택 상세→상태).
5. 승인/수정 배선: 기존 세션 API 호출(행별 sessionId 사용).
6. `loading.tsx`/`error.tsx`.
7. 사이드바·`ROUTES.bookkeeping` 재지정 + 정적 테스트(회사 화면이 reviews 워크스페이스 컴포넌트 미import).

## 9. Acceptance Criteria

- `/dashboard/bookkeeping`가 승인 Preview 구조(분류 현황 → 탭 → 큐 표 → 선택 거래 상세)를 따른다.
- 정규화된 거래가 큐에 AI 추천 계정과목·신뢰도와 함께 표시된다.
- 신뢰도 낮은 거래는 승인 전 "계정 지정"으로 강제 확인된다(`requiresManualAccount`).
- 개별·다중 승인이 기존 세션 API로 동작하고, 승인 시 상태가 confirmed로 바뀐다.
- 선택 거래의 분개 미리보기(차/대변, 균형)와 기간 귀속·부가세 공제 여부가 표시된다(전표 없으면 잠금).
- AI 추천은 초안이며 최종 확정 책임은 사용자에게 있다.
- **회사 기장검토 화면은 GIWA `/dashboard/reviews` 워크스페이스 컴포넌트를 import/render하지 않는다** (정적 테스트로 강제).
- 모든 데이터·mutation은 `tenantId`·`businessEntityId` 범위를 벗어나지 않는다.
- 로딩·빈·오류 상태가 각각 구현된다.

## 10. Open Items

- Layer 5 QA: [04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) 작성 완료(S-01~S-91).
- 전표 생성(journal entry run)을 회사 UI에서 트리거할지, 분류 확정까지만 하고 전표는 후속/내부로 둘지 — v1은 후속.
- 분류 run 시작/재실행의 회사 UI 노출 여부(기본 숨김·자동).
- JC-005 물리 rename 시 `clientId` 참조 갱신(자료수집과 동일).
- 실제 AI 분류 결과·전표는 JC-014(env) 이후에만 E2E 검증 가능.

## 11. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- **UI_Screens**: [Screen Flow 4c](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.3](../02_UI_Screens/01_UI_DESIGN.md) · [Bookkeeping Review Prototype Review](../02_UI_Screens/04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/02_bookkeeping_review.html)
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) · [DB Schema](./03_DB_SCHEMA.md) · [Source Collection Pre-Code Brief](./05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md)
- **QA_Validation**: [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - S-01~S-91 검증 시나리오
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-010 Context Lock
