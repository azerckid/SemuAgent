# JC-043 CUI-4d · 세비서 확인 필요 거래 → 자료대조원장 Pre-Code Brief
> Created: 2026-07-19 00:52
> Last Updated: 2026-07-19 00:52
> Backlog: JC-043 · CUI-4d
> Status: Draft — owner review pending (runtime 착수 금지)
> Related Concept: [04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION](../01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md) · [05_SEBISEO_OPERATING_MODEL](../01_Concept_Design/05_SEBISEO_OPERATING_MODEL.md)
> Related Execution Plan: [01_EXECUTION_PLAN.md](../04_Logic_Progress/01_EXECUTION_PLAN.md) §S3–S4
> Related Prior Brief: [63_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_PRE_CODE_BRIEF](./63_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_PRE_CODE_BRIEF.md) (파일 단위 CUI-4)
> Related Preview: [19_sebiseo.html](../02_UI_Screens/previews/19_sebiseo.html) (파일 카드) · **S2 거래 여정 Preview(`20_…`)는 runtime Gate 전 승인 필요**
> Related QA: [15_JC043_CUI4D_NEEDS_REVIEW_TXN_LEDGER_TEST_SCENARIOS](../05_QA_Validation/15_JC043_CUI4D_NEEDS_REVIEW_TXN_LEDGER_TEST_SCENARIOS.md) (draft)

## 0. Decision

CUI-4d는 CUI-4 **파일 단위** 결과 카드와 분리하여, **거래(분류 행) 단위 확인 필요**를
read-only로 집계하고, CTA로 **같은 tenant·사업장·기간·세션 scope의 자료대조원장**만 연다.

```text
읽기 = bookkeeping_transaction_classification (read-only)
표시 = 세비서 진행 영역 · 파일 카드와 집계 단위를 문구·수치로 구분
이동 = /dashboard/bookkeeping/reconciliation-ledger
       ?period=…&sessionId=…&source=needs_decision
       → 서버가 tenant·사업장·기간·sessionId를 재검증
       → 표는 해당 scope의 확인 필요 거래 행만 표시
금지 = 채팅·카드에서 확정·수정·제외·AI 재실행·mutation
후속 = 구조화 확정·fingerprint·undo = CUI-5
```

CUI-4 파일 카드(`direct-upload?period&sessionId`)는 **유지**한다. CUI-4d는 대체하지 않고
옆에(또는 이어서) **거래 단위** 진입을 추가한다.

## 1. Baseline

| 항목 | 현재 |
|:---|:---|
| 세비서 파일 카드 (CUI-4) | 최근 `staff_direct` 세션 1건 · `upload_file.status` 집계 · CTA → 자료수집 |
| 자료대조원장 | `/dashboard/bookkeeping/reconciliation-ledger` · query: `period`, `source`, `display`, `row` |
| `sessionId` on ledger | **없음** — CUI-4d에서 추가·재검증 필요 |
| 거래 상태 정본 | `bookkeeping_transaction_classification.status` |
| 사이드바 기장검토 badge | `suggested` \| `needs_decision` \| `unclassified` pending count (기간) |
| HTML Preview `20_…` | main에 없음 · S2 Gate 미완 |

## 2. Product Contract (CUI-4d)

### 2.1 In scope

1. **확인 필요 거래 read model (read-only)**
   - 범위: 현재 `tenantId` + 활성 사업장(`client` 1건) + **CUI-4와 동일하게 선택된 최근 `staff_direct` 세션 1건**.
   - 세션이 없거나 period 역산 실패 시 거래 카드/CTA를 **표시하지 않는다**(fail-closed, CUI-4와 동일).
   - 대상 행: `bookkeeping_transaction_classification` WHERE
     - `tenant_id`, `client_id`(사업장),
     - `upload_session_id = session.id`,
     - `status IN ('suggested', 'needs_decision', 'unclassified')`,
     - soft-delete 등 기존 ledger 제외 규칙과 동일.
   - **집계 단위 = 분류 행 1건 = 자료대조원장 표 1행.** 파일 건수와 합산·혼용 금지.

2. **파일 vs 거래 분리 (필수 UX 계약)**
   - 파일 카드 문구: `자료 N건` / `upload_file` 버킷 (CUI-4 유지).
   - 거래 카드(또는 동일 스트립의 거래 블록) 문구: `확인 필요 거래 N건` (또는 동등 명확 라벨).
   - 같은 숫자라도 **파일 N ≠ 거래 N**일 수 있음을 전제로 UI가 단위를 드러낸다.
   - Preview·런타임 모두 단위 혼동 카피를 금지한다(예: 파일 카드에 “거래 7건” 금지).

3. **1:1 대응 계약**
   - 거래 카드의 `needsReviewTxnCount` = CTA landing 후 필터된 원장 행 수.
   - 필터 정의가 바뀌면 카드 집계와 원장 필터를 **같은 함수/규칙**에서 파생한다(드리프트 금지).

4. **CTA (navigation only)**

   ```text
   /dashboard/bookkeeping/reconciliation-ledger?period={periodKey}&sessionId={sessionId}&source=needs_decision
   ```

   | query | 의미 | 서버 |
   |:---|:---|:---|
   | `period` | CUI-4 §4.2.1 역산 `periodKey` | 세션 `accountingPeriod`와 불일치 시 sessionId strip + fail-closed |
   | `sessionId` | 최근 `staff_direct` 세션 | tenant·사업장·source·deletedAt 재검증. 실패 시 strip |
   | `source` | 고정 값 `needs_decision` (CUI-4d 진입) | 허용 allowlist에 추가. 그 외 값은 기존 ledger 동작 유지 |
   | `display`, `row` | 기존 | CUI-4d CTA는 넣지 않음 |

   - 라벨: `확인 필요 거래 {N}건 보기` (`N > 0`일 때만 CTA 활성/표시).
   - `N === 0`이면 거래 카드 숨김 또는 “확인 필요 거래 없음” 읽기 전용(Owner Decision OD-4d-1).
   - 클릭은 **Link/navigation만**. mutation·확정 API 호출 금지.

5. **자료대조원장 landing**
   - `sessionId`가 유효하면: 표는 **해당 세션 + 확인 필요 status 집합** 행만.
   - `sessionId` 없음(사이드바 일반 진입): **기존 기간 전체 ledger 동작 유지**(회귀).
   - 잘못된 tenant/사업장/기간/sessionId: sessionId(및 필요 시 source) strip, 타 tenant 행 **0건**.

6. **갱신**
   - 세비서 페이지 로드·`router.refresh()` 시 거래 집계 재조회.
   - 폴링·클라이언트 추정 금지(CUI-4와 동일 YAGNI).

### 2.2 Out of scope (CUI-4d 금지)

| 항목 | 이유 | 후속 |
|:---|:---|:---|
| 채팅·카드에서 계정 확정·제외·증빙 연결 | Trust / OD-02 | CUI-5 |
| fingerprint·stale·undo | mutation 계약 | CUI-5 |
| 파일 카드 제거·대체 | CUI-4 유지 | — |
| 세션 이력 다중 거래 카드 | 최근 세션 1건 | — |
| 신규 canonical 업무 상태 테이블 | 실행계획 | 세로 흐름 이후 |
| 부가세·급여 확정 진입 | 세목 확장 | Readiness 후 |
| Instant / Mic / Voice | 비활성 유지 | — |

## 3. Responsibility Boundary

| 계층 | CUI-4d 책임 | 정본 |
|:---|:---|:---|
| 세비서 거래 카드 | 건수 표시·원장 deep link | 아님 |
| `bookkeeping_transaction_classification` | 거래 상태·uploadSessionId | DB |
| 자료대조원장 | 행 검토 UI(기존). CUI-4d는 필터·재검증만 추가 | 기존 UI |
| 구조화 확정 | 계정·증빙·제외 mutation | CUI-5 |

## 4. Read Model Contract

### 4.1 스키마 (Zod)

```ts
SebiseoNeedsReviewTxnCard = {
  sessionId: string
  periodKey: string
  periodLabel: string          // CUI-4 formatSebiseoPeriodLabel 재사용
  needsReviewTxnCount: number  // >= 1 일 때만 카드 표시(OD-4d-1에 따름)
  ctaHref: string
  ctaLabel: string
} | null
```

파일 카드(`SebiseoUploadResultCard`)와 **타입·카피·CTA 경로를 공유하지 않는다.**

### 4.2 조회 규칙

```text
1) CUI-4와 동일: 최근 staff_direct 세션 1건 + periodKey 역산 (실패 시 null)
2) SELECT count(*) FROM bookkeeping_transaction_classification
     WHERE tenant_id AND client_id AND upload_session_id = session.id
       AND status IN ('suggested','needs_decision','unclassified')
       AND <기존 ledger 활성 행 조건>
3) count === 0 → null (또는 OD-4d-1 empty state)
4) ctaHref = buildSebiseoNeedsReviewTxnCtaHref(periodKey, sessionId)
```

| 규칙 | 결정 |
|:---|:---|
| tenant / 사업장 격리 | 모든 query 필수 |
| 세션 scope | `upload_session_id` 필수(카드·landing 공통) |
| 파일 status | 거래 집계에 **사용 금지** |
| evidenceActionState 탭 | CUI-4d 기본 CTA는 status 집합만. 증빙/소명 세분 탭은 원장 내 기존 UI로 추가 조작 |

### 4.3 자료대조원장 서버 재검증 (신규)

`reconciliation-ledger/page.tsx`(또는 공용 deep-link helper):

```text
resolveReconciliationSessionScope({ tenantId, clientId, periodKey, sessionId })
→ { ok: true, sessionId } | { ok: false }  // false면 query에서 sessionId 제거
```

검증: 세션 존재, `source='staff_direct'`, `deletedAt` null, tenant/client 일치,
`accountingPeriod` ↔ `periodKey` 역산 일치(CUI-4 §4.2.1 재사용).

필터 적용 후 행 집합 정의는 §4.2 status 집합과 **동일 함수**를 쓴다.

## 5. UI Contract

- 데스크톱: CUI-4 가로 스트립과 정합 — 일정 | 파일 카드 | **거래 카드**(또는 파일 카드 하단 거래 CTA 블록). 최종 배치는 **S2 HTML Preview 승인본**을 따른다.
- 모바일: 세로 스택. 파일 단위와 거래 단위 라벨이 인접해도 혼동되지 않게 구분.
- ‘자’ 로고·상단 바 계약은 shell(#286)을 따르며 본 Brief 범위 밖.

## 6. API Surface

**신규 public API 없음.** 서버 컴포넌트 read model + ledger page query 재검증만.

## 7. Reuse / New / Do Not Touch

### 7.1 Reuse

| 자산 | 용도 |
|:---|:---|
| CUI-4 세션 선택·period 역산·라벨 | 동일 세션·기간 |
| `bookkeeping_transaction_classification` | 거래 상태 |
| `lib/bookkeeping-review/*` pending 정의 | status 집합 정합 |
| reconciliation-ledger page | landing · 기존 `period`/`source` |
| Dashboard shell | 네비·상단 바 |

### 7.2 New

| 자산 | 책임 |
|:---|:---|
| `lib/sebiseo/needs-review-txn.ts` (가칭) | count + Zod + CTA builder + unit test |
| ledger `sessionId` deep-link helper | 재검증·fail-closed + unit test |
| 세비서 거래 카드 UI | Preview 정합 |
| `source=needs_decision` allowlist 연결 | 필터 1:1 |

### 7.3 Do not touch

| 자산 | 이유 |
|:---|:---|
| CUI-4 파일 카드 CTA → direct-upload | 유지 |
| `POST /api/sebiseo/chat` | mutation 없음 |
| reconciliation row mutations | CUI-5 |
| VAT/payroll 확정 | 범위 밖 |

## 8. Delivery Slices (Brief·Preview·QA 승인 후)

| Slice | 산출물 | 완료선 |
|:---|:---|:---|
| CUI-4d-a | read model + Zod + unit | count·세션·period fail-closed |
| CUI-4d-b | ledger sessionId 재검증 + 필터 1:1 | R-시나리오 단위/통합 |
| CUI-4d-c | 세비서 거래 카드 UI + refresh | Preview 정합 · mutation 0 |

## 9. Gates Before Runtime

1. **본 Brief 오너 승인** (Owner Decisions 포함)
2. **QA 15 draft 오너 승인**
3. **S2 HTML Preview Gate** — 파일 vs 거래 구분·필터 원장 진입 화면 오너 확인
   (`20_sebiseo_first_vertical_journey.html` 또는 동등 승인 Preview)
4. Pre-Code Technical Brief Gate Out → 그때만 runtime PR 착수

## 10. Owner Decisions (승인 필요)

| ID | 질문 | 권고 기본값 |
|:---|:---|:---|
| OD-4d-1 | 거래 0건일 때 카드 숨김 vs “없음” 문구 | **숨김** (CUI-4 파일 0건과 동일) |
| OD-4d-2 | 확인 필요 status 집합 | **`suggested` \| `needs_decision` \| `unclassified`** (사이드바 pending과 동일) |
| OD-4d-3 | 세션 scope | **CUI-4 최근 staff_direct 1건의 upload_session_id** |
| OD-4d-4 | CTA `source` 토큰 | **`needs_decision`** (allowlist 신규, 기존 탭과 충돌 시 문서화) |
| OD-4d-5 | 파일 카드와 동시 노출 | **동시 노출 허용** (단위만 분리). 레이아웃은 S2 Preview |
| OD-4d-6 | CUI-5 전 mutation | **금지** (카드·채팅·landing 클릭만) |

## 11. Document Sync

승인 시 갱신:

- [ ] `00_BACKLOG.md` JC-043 CUI-4d Brief 링크
- [ ] `01_EXECUTION_PLAN.md` S3 체크
- [ ] `00_SCREEN_FLOW.md` 세비서 → 자료대조원장 거래 필터 흐름
- [ ] Concept 04 Delivery Plan 상태 한 줄

## 12. Non-Goals Reminder

자동 신고, 숨은 확정, 자격증명 저장, 채팅만으로 고위험 mutation 완료는
운영모델 Non-Goal이며 CUI-4d에서도 허용하지 않는다.
