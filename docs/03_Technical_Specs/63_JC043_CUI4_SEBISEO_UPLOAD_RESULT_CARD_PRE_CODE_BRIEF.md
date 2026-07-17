# JC-043 CUI-4 · 세비서 업로드 결과 카드 Pre-Code Brief
> Created: 2026-07-17 18:55
> Last Updated: 2026-07-17 20:00
> Backlog: JC-043 · CUI-4
> Status: Brief approved (PR #272) · **CUI-4a runtime merged (PR #273)** · Browser R-04/R-09 Pending on logged-in staging
> Related Concept: [04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION](../01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md)
> Related Preview: [19_sebiseo.html](../02_UI_Screens/previews/19_sebiseo.html) (CUI-4 결과 카드 · 오너 승인 PR #271)
> Related Prior Brief: [62_JC043_CUI3_SEBISEO_UPLOAD_CHAT_PRE_CODE_BRIEF](./62_JC043_CUI3_SEBISEO_UPLOAD_CHAT_PRE_CODE_BRIEF.md)
> Related QA: [13_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_TEST_SCENARIOS](../05_QA_Validation/13_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_TEST_SCENARIOS.md) (draft)

## 0. Decision

CUI-4는 CUI-3 위에 **최근 `staff_direct` 업로드 세션 1건**의 실제 DB 파일 상태만 카드로 표시하고,
CTA로 **같은 `period + sessionId`의 자료수집 화면**만 연다.

```text
읽기 = upload_session + upload_file 집계(read-only)
표시 = 세비서 첫 화면·업로드 직후 카드 1개
이동 = /dashboard/direct-upload?period=…&sessionId=…
       → 서버가 sessionId를 tenant·사업장·기간까지 재검증
       → 가져오기 상태 표는 해당 세션 파일만 표시 (같은 기간 다른 세션 혼입 금지)
금지 = 채팅·카드에서 확정·수정·AI 재실행·mutation
후속 = 구조화 확정·fingerprint = CUI-5
       거래 건수·기장검토 필터 진입 = CUI-4+ (본 Brief 범위 밖)
       회사별 Ready/미확정 canonical 카드 = CUI-4+ (본 Brief 범위 밖)
```

CUI-3 trust 계약은 유지한다. 첫 화면 로드 시 LLM provider 호출은 없다.
업로드 후 자동 LLM 요약·자동 재분석 트리거도 추가하지 않는다.

## 1. Baseline (CUI-3 완료 후)

| 항목 | 현재 |
|:---|:---|
| Route | `/dashboard/sebiseo` |
| 업로드 | 기간 확인 → `staff_direct` 세션·Blob·submit (CUI-3a) |
| 업로드 후 thread | 텍스트 system 메시지 + `period`만 있는 `자료수집 열기` 링크 |
| 결과 카드 | **없음** (Preview만 존재) |
| 자료수집 deep link | `direct-upload/page.tsx`가 `sessionId` query로 **업로드 패널**만 연다. `summary.importRows`(가져오기 상태 표)는 **기간 전체** 파일을 표시 — **CUI-4에서 세션 필터 보강 필요** |
| Chat | CUI-3b/c 화이트리스트 대화 + 화면 이동 CTA (mutation 없음) |

## 2. Product Contract (CUI-4)

### 2.1 In scope

1. **최근 업로드 세션 1건 조회 (read-only)**
   - 범위: 현재 `tenantId` + 활성 사업장(`client` 1건, 자료수집과 동일 규칙).
   - 대상: `upload_session.source = 'staff_direct'` 이고 `deletedAt IS NULL`.
   - 선택: `createdAt DESC` 최신 1건. **기간 필터로 후보를 줄이지 않는다.**
   - 세션이 없으면 카드를 렌더하지 않는다.

2. **파일 상태 집계 (세션 소속 `upload_file`만)**
   - 정본: `upload_file.status` (자료수집과 동일 enum).
   - 표시 버킷(Preview·런타임 공통):

   | DB status | 카드 집계 | 사용자 라벨 |
   |:---|:---|:---|
   | `matched` | `okCount` | 정상 |
   | `needs_review` | `needsReviewCount` | 확인 필요 |
   | `uploaded`, `analyzing` | `inProgressCount` | 진행 중 |
   | `failed` | `failedCount` | 오류 |
   | `rejected` | `excludedCount` | 제외 |

   - `totalCount = okCount + needsReviewCount + inProgressCount + failedCount + excludedCount`.
   - `totalCount === 0`이면 카드를 숨긴다(빈 세션 방지).
   - **가짜 건수·추정 진행률 금지.** DB에 없는 숫자를 채우지 않는다.

3. **결과 카드 UI (Preview 정합)**
   - 라벨: `{periodLabel} · 직접 업로드` — §4.2.1 역산 key를 §4.2.2 순수 표시 헬퍼로 변환. `buildSebiseoPeriodOptions()`/`findSebiseoPeriodOption()`에 **의존하지 않는다**.
   - 제목: `자료 {totalCount}건을 정리했습니다` (파일 단위. 거래 건수 아님).
   - 메타: 0이 아닌 버킷만 `정상 N건 · 확인 필요 N건 · …` 형태로 연결.
   - 상태 배지: `needsReviewCount > 0`이면 `확인 필요 {needsReviewCount}` (Preview와 동일 톤).
   - 카드 위치:
     - **첫 방문/재방문**: 환영 문구 아래, thread 위에 **항상 표시**(Preview의 접힌 `<details>`는 예시용이며 runtime은 펼친 상태).
     - **같은 방문 중 업로드 직후**: 업로드 성공 시 카드를 갱신한다. 기존 system 텍스트 링크(`period`만)는 **결과 카드 CTA로 대체**한다.

4. **CTA (navigation only)**
   - href (고정 계약):

     ```text
     /dashboard/direct-upload?period={periodKey}&sessionId={sessionId}
     ```

   - `periodKey`는 해당 세션의 `accountingPeriod`에서 §4.2.1로 역산한다. 역산 실패 시 카드 자체를 숨긴다(fail-closed).
   - 라벨 규칙:
     - `needsReviewCount > 0` → `확인 필요 {needsReviewCount}건 보기`
     - 그 외 → `자료수집에서 보기`
   - 클릭은 **Link/navigation만**. query 조작으로 mutation·확정·재분석 API를 호출하지 않는다.
   - `fileId` 단위 딥링크·기장검토·자료대조원장 CTA는 **CUI-4 범위 밖**.
   - CTA의 약속은 “결과 카드에 집계된 **그 세션의 실제 파일 행**으로 이동”이다. 업로드 패널만 열리고 표가 기간 전체를 보여주면 **계약 위반**이다(§4.3).

5. **갱신 타이밍**
   - 페이지 최초 로드: 서버 read model로 카드 prop 전달.
   - 업로드 submit 성공 직후: `router.refresh()` 또는 동등한 서버 재조회로 카드 갱신.
   - 분석 중(`analyzing`) 상태는 DB 재조회 시점의 값만 반영. 클라이언트 추정 타이머·폴링 루프는 **만들지 않는다**(YAGNI). 사용자가 새로고침·재진입·다음 방문 시 자연 갱신.

### 2.2 Out of scope (CUI-4 금지)

| 항목 | 이유 | 후속 |
|:---|:---|:---|
| 거래·행 건수 카드 (`324건 정리 · 7건 확인`) | 파일 단위만. 기장검토 read model 별도 | CUI-4+ |
| 채팅·카드에서 확정·수정·삭제 | Trust Contract | CUI-5 |
| 카드/채팅에서 AI 재실행·재분석 트리거 | mutation 금지 | 자료수집 화면 기존 retry |
| 업로드 후 자동 LLM 요약 | CUI-3 Owner Decision #3 | — |
| 회사별 Ready·미확정·blocker canonical 카드 | 범위 축소 | CUI-4+ |
| 법령·실무 참고 intent | 별도 slice | CUI-4b+ (별도 Brief) |
| 세션 이력 목록·다중 카드 | 최근 1건만 | — |
| 채팅 이력 DB 영구 저장 | Concept Non-Goal | — |
| Instant / Mic / Voice | CUI-2 비활성 유지 | 별도 에픽 |
| 새 업로드 테이블·분석 엔진 | 자료수집 재사용 | — |

## 3. Responsibility Boundary

| 계층 | CUI-4 책임 | 정본 |
|:---|:---|:---|
| 결과 카드 | 최근 세션 파일 집계 표시·자료수집 deep link | 아님 |
| `upload_session` / `upload_file` | 세션·파일·분석 상태 | DB |
| 자료수집 화면 | 파일 상세·retry·password·정규화 확인 | 기존 UI |
| 구조화 확정 | 거래·급여·세액 확정 | CUI-5 |

카드·대화·자료수집 화면이 다르면 **DB canonical 상태를 우선**한다.

## 4. Read Model Contract

### 4.1 함수 (신규 · 권장 위치)

`lib/sebiseo/upload-result.ts` (가칭)에 **read-only** 집계를 둔다.

```ts
// Zod로 export schema 정의 (API·서버 컴포넌트 공용)
SebiseoUploadResultCard = {
  sessionId: string
  periodKey: string          // company-home period key
  periodLabel: string        // §4.2.2 — "2026년 하반기" 등. findSebiseoPeriodOption 금지
  totalCount: number
  okCount: number
  needsReviewCount: number
  inProgressCount: number
  failedCount: number
  excludedCount: number
  ctaHref: string            // /dashboard/direct-upload?period=…&sessionId=…
  ctaLabel: string
} | null   // null = 카드 미표시
```

### 4.2 조회 규칙

```text
1) requireTenantSession → tenantId
2) 활성 businessEntityId (client 1건, source-collection과 동일)
3) upload_session WHERE tenant_id, client_id, source='staff_direct', deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1
4) accountingPeriod → periodKey (§4.2.1) → periodLabel (§4.2.2). 어느 단계든 실패면 null(카드 숨김)
5) upload_file WHERE upload_session_id = session.id AND tenant_id
6) status별 count → SebiseoUploadResultCard | null
```

| 규칙 | 결정 |
|:---|:---|
| tenant 격리 | 모든 query에 `tenantId` 필수 |
| 사업장 격리 | `clientId = businessEntityId` |
| 타 테넌트 `sessionId` | CTA·서버 모두 404/redirect 처리 (기존 direct-upload와 동일) |
| storage key·blob URL | 노출 금지 · `file-display` safe title만(카드 제목에는 파일명 나열 생략 가능) |
| period 역산·표시 | §4.2.1·§4.2.2 신규 헬퍼만 사용. 옵션 후보 목록·추정·defaultKey 대체 금지 · 실패 시 fail-closed |

#### 4.2.1 `accountingPeriod` → `periodKey` 역산 (신규 헬퍼 · 필수)

`lib/sebiseo/period-options.ts`에는 현재 **순방향**(후보 옵션 생성)만 있다.
CUI-4 read model은 세션에 저장된 `upload_session.accounting_period`를 CTA query의
`period` key로 바꿔야 하므로, **역산 헬퍼를 신규 추가**한다.

| 입력 (`accountingPeriod`) | 출력 (`periodKey`) | 근거 |
|:---|:---|:---|
| `YYYY-MM` (예: `2026-07`) | 동일 `YYYY-MM` | `monthOption`이 `accountingPeriod = key`로 저장 |
| `YYYY-MM~YYYY-MM` 이고 start=`YYYY-01`, end=`YYYY-06` (예: `2026-01~2026-06`) | `YYYY-H1` | `halfOption(year, 1)` |
| `YYYY-MM~YYYY-MM` 이고 start=`YYYY-07`, end=`YYYY-12` (예: `2026-07~2026-12`) | `YYYY-H2` | `halfOption(year, 2)` |

변환 규칙(의사코드):

```text
resolveSebiseoPeriodKeyFromAccountingPeriod(value: string): string | null

1) trim
2) if match /^(\d{4})-(0[1-9]|1[0-2])$/ → return same string
3) if match /^(\d{4})-(0[1-9]|1[0-2])~(\d{4})-(0[1-9]|1[0-2])$/
     - yearStart === yearEnd 필수(연도 불일치 → null)
     - (01,06) → `${year}-H1`
     - (07,12) → `${year}-H2`
     - 그 외 월 쌍 → null
4) 그 외 형식(빈 문자열, Q1, 단일 월이 아닌 범위, `2026-H1` 원문 등) → null
```

**Fail-closed:**

- 역산이 `null`이면 `loadSebiseoUploadResultCard`는 **카드를 반환하지 않는다**(`null`).
- CTA href를 추정 기간으로 채우거나 기본 `defaultKey`로 대체하지 **않는다**.
- 로그는 운영 디버그용으로만 남기고 사용자에게 오류 배너를 강제하지 않는다(조용히 숨김).

#### 4.2.2 `periodKey` → 표시 라벨 (순수 헬퍼 · 필수)

최근 세션은 **기간 후보 제한 없이** 고른다(§2.1). 반면 `buildSebiseoPeriodOptions()`는
현재·직전 월과 최근 반기만 만든다. 따라서 과거 연도 세션(예: `2025-H1`)은
`findSebiseoPeriodOption(options, key)`로 라벨을 찾지 못할 수 있다.

카드 eyebrow/라벨은 **옵션 목록에 의존하지 않는** 순수 표시 헬퍼만 사용한다.

| 입력 (`periodKey`) | 출력 (`periodLabel`) |
|:---|:---|
| `YYYY-MM` (예: `2026-07`) | `{YYYY}년 {M}월` (예: `2026년 7월`) — 월은 선행 0 제거 |
| `YYYY-H1` (예: `2026-H1`) | `{YYYY}년 상반기` |
| `YYYY-H2` (예: `2026-H2`) | `{YYYY}년 하반기` |
| 그 외 | `null` → 카드 숨김 |

```text
formatSebiseoPeriodLabel(periodKey: string): string | null

1) trim
2) if match /^(\d{4})-(0[1-9]|1[0-2])$/ → `${year}년 ${Number(month)}월`
3) if match /^(\d{4})-H1$/ → `${year}년 상반기`
4) if match /^(\d{4})-H2$/ → `${year}년 하반기`
5) else → null
```

**금지:**

- `buildSebiseoPeriodOptions()` / `findSebiseoPeriodOption()`으로 카드 라벨 조회
- 업로드 confirm UI의 `confirmLabel`/`detailLabel`/`periodLabel` 문자열을 카드에 재사용
  (후보에 없는 key면 실패하므로)
- 라벨을 못 찾을 때 `defaultKey`·오늘 날짜·임의 문구로 대체

**Fail-closed:** §4.2.1 역산이 성공해도 §4.2.2가 `null`이면 카드를 숨긴다.

**구현·테스트 위치:**

| 자산 | 책임 |
|:---|:---|
| `lib/sebiseo/period-options.ts` | `resolveSebiseoPeriodKeyFromAccountingPeriod` + `formatSebiseoPeriodLabel` 추가(client-safe, `lib/db` 금지) |
| `lib/sebiseo/period-options.test.ts` | 역산: 월·H1·H2 + 비표준 → `null`. 표시: `2026-07`/`2026-H1`/`2026-H2` + **과거 연도**(`2025-03`, `2025-H1`, `2024-H2`) + 비표준 → `null` |

카드 파이프라인:

```text
session.accountingPeriod
  → resolveSebiseoPeriodKeyFromAccountingPeriod → periodKey | null
  → formatSebiseoPeriodLabel(periodKey) → periodLabel | null
  → 둘 다 non-null일 때만 SebiseoUploadResultCard 구성
```

Impact Scope: `lib/source-collection/summary.ts`를 직접 수정하지 않고, **공유 status 라벨만 import**한다.
summary 변경이 필요하면 세비서 전용 thin wrapper로 격리하고 자료수집 회귀 테스트를 돌린다.
`period-options` 역산·표시 헬퍼는 **세비서 결과 카드·CTA 전용**이며 company-home `normalizePeriodKey`와
업로드 confirm 후보 목록을 바꾸지 않는다.

### 4.3 Source Collection Session Deep Link Contract (CTA 정본)

CUI-4 CTA는 세비서 결과 카드와 **동일 세션·동일 파일 집합**을 자료수집 화면에서 보여줘야 한다.
현재 `sessionId` query는 업로드 패널(`uploadSession`·`uploadedFiles`)만 좁히고,
`summary.importRows`(가져오기 상태 표)는 기간 내 **모든 세션** 파일을 포함할 수 있다.
**runtime 구현 시 아래 계약을 만족하도록 자료수집 read path를 보강한다.**

#### 4.3.1 서버 재검증 (필수)

`direct-upload/page.tsx`(또는 공유 loader)에서 `sessionId` query가 있으면 **렌더 전** 다음을 모두 확인한다.

| 검증 | 규칙 | 실패 시 |
|:---|:---|:---|
| tenant | `upload_session.tenant_id = activeTenantId` | §4.3.3 |
| 사업장 | `upload_session.client_id = activeBusinessEntityId` | §4.3.3 |
| source | `upload_session.source = 'staff_direct'` | §4.3.3 |
| 삭제 | `upload_session.deleted_at IS NULL` | §4.3.3 |
| 기간 | `upload_session.accounting_period`가 query `period`의 `startMonth~endMonth` 범위 안 | §4.3.3 |
| period 정합 | query `periodKey`가 세션 `accountingPeriod`에서 §4.2.1로 역산한 key와 **일치** | §4.3.3 |

검증 통과 시에만 `uploadSession`·세션 scoped import rows를 사용한다.
클라이언트가 query를 조작해도 서버 검증이 최종 gate다.

#### 4.3.2 가져오기 상태 표 세션 필터 (필수)

유효 `sessionId`가 있을 때:

- **가져오기 상태 표**(`ImportStatusTableSection`)는 `upload_file.upload_session_id = sessionId`인 행**만** 표시한다.
- 같은 `period`에 다른 `staff_direct` 세션으로 업로드한 파일은 **표에 나타나지 않는다**.
- 카드의 `totalCount`·`needsReviewCount`와 표 행 수·status가 **1:1로 대응**해야 한다.
- 수집 완결성 헤더·자료유형 타일·missing checklist는 **기간 전체 summary를 유지**할 수 있다(본 Brief 범위).
  사용자가 “이번 업로드 결과”를 보는 주 표면은 가져오기 상태 표뿐이다.

구현 권장:

```text
valid sessionId
  → importRowsForView = summary.importRows.filter(row => row.uploadSessionId === sessionId)
  → 또는 loadSourceCollectionSummary에 optional sessionId scope 추가(회귀 테스트 필수)
```

`sessionId` 없는 일반 자료수집 진입은 **기존 동작 유지**(기간 전체 importRows).

#### 4.3.3 무효 sessionId 처리 (필수)

다음은 **무효**로 간주하고 안전하게 기본 화면으로 복귀한다.

- 다른 tenant의 `sessionId`
- 다른 사업장(`clientId`)의 `sessionId`
- query `period`와 `accountingPeriod` 불일치
- 삭제·존재하지 않는 세션
- `staff_direct`가 아닌 세션

처리:

```text
redirect(`/dashboard/direct-upload?period={resolvedPeriodKey}`)
```

- `sessionId` query는 **제거**한다(strip).
- 404·에러 페이지 대신 **기간 기본 자료수집 화면**으로 복귀(기존 redirect 패턴 유지).
- 무효 sessionId로 타 tenant 데이터가 한 행이라도 노출되면 **실패**다.

#### 4.3.4 카드 ↔ 화면 정합

| 항목 | 규칙 |
|:---|:---|
| CTA href | 카드 read model이 만든 `sessionId`·`periodKey`만 사용 |
| 표 행 | CTA landing 후 import 표 행 ⊆ 카드 집계 파일 집합 |
| 혼입 | 같은 기간 다른 세션 파일 0건 |
| 업로드 패널 | 검증된 `uploadSession`·`uploadedFiles` = 해당 세션 |

## 5. UI / Runtime Wiring

### 5.1 서버

`app/(dashboard)/dashboard/sebiseo/page.tsx`:

- 기존 `loadSourceCollectionSummary`는 period 옵션·사업장용으로 유지.
- 추가: `loadSebiseoUploadResultCard({ tenantId, businessEntityId })` → prop `uploadResult`.
- **LLM provider 호출 없음** (기존과 동일).

### 5.2 클라이언트

`sebiseo-workspace.tsx`:

- prop `initialUploadResult` 수신.
- `SebiseoUploadResultCard` 컴포넌트(신규)로 렌더.
- `confirmPeriodAndUpload` 성공 후:
  1. `router.refresh()`로 서버 read model 재조회 **또는**
  2. 응답 `sessionId` + 확인 period로 클라이언트가 동일 Zod schema를 채우되, **집계 숫자는 서버 재조회 결과만 신뢰**(초기 구현은 `router.refresh()` 권장).
- 업로드 성공 system 메시지의 `href`/`hrefLabel` **제거** → 카드 CTA로 일원화.

### 5.3 컴포넌트 (신규)

| 컴포넌트 | 책임 |
|:---|:---|
| `sebiseo-upload-result-card.tsx` | Preview `result-card` 구조를 runtime 토큰에 맞게 구현 |
| `sebiseo-upload-result-card.test.tsx` | 라벨·CTA·0건 숨김·needs_review 배지 |

스타일은 Preview `19_sebiseo.html`의 `result-card*` 클래스 의미를 Tailwind로 이식한다.

## 6. API Surface

**신규 public API는 만들지 않는다**(YAGNI). 서버 컴포넌트 read model만으로 충분하다.

업로드 후 갱신은 `router.refresh()` + 동일 read function 재사용.

(후속 필요 시에만 `GET /api/sebiseo/upload-result` 검토 — CUI-4에서는 금지)

## 7. Reuse / New / Do Not Touch

### 7.1 Reuse

| 자산 | 용도 |
|:---|:---|
| `direct-upload/page.tsx` `sessionId`·`period` query | CTA 대상 · §4.3 세션 재검증·import 표 필터 |
| `source-collection.tsx` `ImportStatusTableSection` | `sessionId` scope prop 또는 filtered rows |
| `lib/source-collection/summary.ts` status 라벨·period 빌더 | 집계 라벨 정합 |
| `lib/company-home/summary` period helpers | `periodKey`·라벨 |
| `lib/upload/file-display` | 파일명 노출 시 safe title |
| `lib/sebiseo/period-options` | 업로드 기간 확인(기존 순방향 후보) + §4.2.1 역산 + §4.2.2 순수 표시 라벨 |

### 7.2 New

| 자산 | 책임 |
|:---|:---|
| `resolveSebiseoPeriodKeyFromAccountingPeriod` | `accountingPeriod` → `periodKey` · fail-closed · unit test |
| `formatSebiseoPeriodLabel` | `periodKey` → 표시 라벨 · 옵션 목록 비의존 · 과거 연도 포함 unit test |
| `lib/sebiseo/upload-result.ts` | read model + Zod schema + unit test |
| `sebiseo-upload-result-card.tsx` | 카드 UI |
| `sebiseo/page.tsx` · `sebiseo-workspace.tsx` | prop 전달·refresh·카드 슬롯 |
| `direct-upload/page.tsx` + view props | §4.3 sessionId 재검증 · importRows 세션 필터 |

### 7.3 Do not touch

| 자산 | 이유 |
|:---|:---|
| `POST /api/sebiseo/chat` | 대화 범위와 분리 |
| `lib/ai/consultation/*` | 법령 참고는 별도 slice |
| bookkeeping·VAT read model | 거래 건수 카드 범위 밖 |
| upload mutation routes | CUI-4는 read-only |

## 8. Delivery Slices (Brief 승인 후)

| Slice | 산출물 | 완료선 |
|:---|:---|:---|
| **CUI-4a** | §4.2.1·§4.2.2 period 헬퍼 + `loadSebiseoUploadResultCard` + Zod + unit test + 카드 UI + page prop + §4.3 import 표 세션 필터 | tenant/사업장/기간 격리. 역산·표시 실패·세션 없음 → 미표시. 과거 연도 라벨 OK. CTA landing 시 표 혼입 0 |
| **CUI-4b** | 업로드 직후 `router.refresh()`·system 링크 제거·CTA 일원화 | submit 후 카드가 같은 `sessionId`로 갱신 |
| **CUI-4c** | QA 시나리오 + 회귀 | [QA 13](../05_QA_Validation/13_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_TEST_SCENARIOS.md) 통과 · 자료수집 S-60~S-64 회귀 |

각 slice는 별도 PR. **본 Brief는 오너 승인됨(PR #272). CUI-4a부터 runtime 착수 가능.**

## 9. Acceptance Criteria

- [ ] 활성 사업장의 최근 `staff_direct` 세션 1건만 카드에 표시한다.
- [ ] 카드 숫자는 해당 세션의 `upload_file.status` 집계와 일치한다.
- [ ] 세션·파일이 없으면 카드를 렌더하지 않는다.
- [ ] `accountingPeriod` → `periodKey` 역산이 실패하면 카드를 숨긴다(기본 period로 CTA를 추정하지 않음).
- [ ] 월(`YYYY-MM`)·반기(`YYYY-01~YYYY-06`→H1, `YYYY-07~YYYY-12`→H2) 역산과 비표준 입력 `null` 단위 테스트가 있다.
- [ ] 카드 라벨은 `formatSebiseoPeriodLabel`만 사용한다. `findSebiseoPeriodOption`/후보 목록에 의존하지 않는다.
- [ ] `2026-07`→`2026년 7월`, `2026-H1`→`2026년 상반기`, `2026-H2`→`2026년 하반기`, 그 외→`null`(카드 숨김).
- [ ] 과거 연도(`2025-03`, `2025-H1`, `2024-H2`) 표시 라벨 단위 테스트가 있다.
- [ ] CTA는 `/dashboard/direct-upload?period={periodKey}&sessionId={sessionId}`만 사용한다.
- [ ] `needsReviewCount > 0`일 때 CTA 라벨이 `확인 필요 N건 보기`이다.
- [ ] 카드·채팅 클릭으로 확정·수정·AI 재실행·재분석 mutation이 발생하지 않는다.
- [ ] 첫 화면 로드·카드 갱신 시 LLM provider를 호출하지 않는다.
- [ ] 업로드 후 자동 LLM 요약을 추가하지 않는다.
- [ ] CTA landing 후 **가져오기 상태 표**에 해당 `sessionId` 파일만 표시한다(같은 기간 다른 세션 혼입 0).
- [ ] `sessionId`는 서버에서 tenant·사업장·기간·source까지 재검증한다.
- [ ] 무효·타 tenant·타 사업장·기간 불일치 `sessionId`는 query strip 후 기본 자료수집 화면으로 복귀한다.
- [ ] 카드 집계 건수와 필터된 import 표 행·status가 일치한다.
- [ ] Preview `19_sebiseo.html` 결과 카드 구조·톤과 시각적으로 정합한다.
- [ ] 자료수집 기존 업로드·`sessionId` 없는 진입 회귀가 통과한다.

## 10. Owner Decisions (2026-07-17 승인)

| # | 질문 | 권장안 | 상태 |
|:---|:---|:---|:---|
| 1 | 최근 세션 선택 | tenant+사업장 전체에서 `createdAt` 최신 1건 | **승인** |
| 2 | 카드 수치 단위 | 파일 status 집계만 (거래 건수 제외) | **승인** |
| 3 | 분석 중 갱신 | 폴링 없음 · refresh/재진입 시 DB 재조회 | **승인** |
| 4 | 업로드 후 system 링크 | 제거하고 결과 카드 CTA로 통합 | **승인** |
| 5 | 신규 API | 없음 (server read + `router.refresh()`) | **승인** |
| 6 | CTA landing import 표 | 유효 `sessionId`일 때 해당 세션 파일만 표시 · 무효 sessionId strip redirect | **승인** |
| 7 | period 역산 | §4.2.1 표·의사코드 · 실패 시 카드 숨김(fail-closed) · `period-options`에 헬퍼+테스트 추가 | **승인** |
| 8 | period 표시 라벨 | §4.2.2 순수 헬퍼 · 옵션 후보 비의존 · 과거 연도 포함 · 실패 시 카드 숨김 | **승인** |

## 11. Document Sync (구현 전)

Brief 승인 시 동기화 대상:

- [ ] `04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md` Status
- [ ] `00_SCREEN_FLOW.md` §2.1 CUI-4 runtime 대기 → 진행
- [ ] `00_BACKLOG.md` JC-043 CUI-4 Brief 체크
- [ ] QA 13 시나리오 draft ([13](../05_QA_Validation/13_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_TEST_SCENARIOS.md))

---

**다음 단계:** CUI-4a runtime PR — §4.2.1·§4.2.2 period 헬퍼 + 결과 카드 + §4.3 import 표 세션 필터.
