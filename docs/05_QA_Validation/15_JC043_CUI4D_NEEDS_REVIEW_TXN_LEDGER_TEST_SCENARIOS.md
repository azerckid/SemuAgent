# JC-043 CUI-4d · 확인 필요 거래 → 자료대조원장 QA 시나리오
> Created: 2026-07-19 00:52
> Last Updated: 2026-07-19 00:52
> Backlog: JC-043 · CUI-4d
> Status: Draft — S2 Preview Gate 후 Brief와 함께 승인. T-06~T-09 fail-closed는 **0행 빈 상태**로 단일 고정.
> Related Brief: [65_JC043_CUI4D_NEEDS_REVIEW_TXN_LEDGER_PRE_CODE_BRIEF](../03_Technical_Specs/65_JC043_CUI4D_NEEDS_REVIEW_TXN_LEDGER_PRE_CODE_BRIEF.md)
> Related Prior QA: [13_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_TEST_SCENARIOS](./13_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_TEST_SCENARIOS.md)
> Related Preview: S2 거래 여정 Preview(`20_…`) 승인본 (runtime Gate 전)

## 1. Scope

CUI-4d runtime 검증 대상:

- 세비서 **거래 단위** 확인 필요 집계(read-only)
- 파일 카드(CUI-4)와 **집계 단위·CTA 경로 분리**
- CTA `period + sessionId + source=needs_decision` → 자료대조원장
- landing 행 집합과 카드 건수 **1:1**
- mutation·확정·AI 재실행 없음

Out of scope: CUI-5 확정·fingerprint·undo, 파일 카드 계약 변경.

## 2. Preconditions

- tenant A 활성 사업장 1건
- 최근 `staff_direct` 세션 S1과 분류 행 fixture 가능
- 자료대조원장 일반 진입(기간만) 회귀 가능
- 확인은 **로컬 또는 로그인 가능 환경**. staging은 당분간 기본 QA 경로로 쓰지 않는다.

## 3. Scenarios

| ID | 시나리오 | 단계 | 기대 결과 | 상태 |
|:---|:---|:---|:---|:---|
| T-01 | 거래 카드 미표시 | S1에 확인 필요 분류 0건 | 거래 카드 없음(OD-4d-1). 파일 카드는 CUI-4 규칙 | Pending |
| T-02 | 파일≠거래 분리 | S1 파일 2건·확인 필요 거래 3건 | 파일 카드 `자료 2건`, 거래 카드 `확인 필요 거래 3건`. 단위 문구 혼동 없음 | Pending |
| T-03 | CTA href | 거래 카드 CTA 확인 | `/dashboard/bookkeeping/reconciliation-ledger?period=…&sessionId=…&source=needs_decision` | Pending |
| T-04 | **1:1 행 대응** | CTA landing 후 표 행 수 | 행 수 = 카드 `needsReviewTxnCount`. 다른 세션·confirmed 행 미포함 | Pending |
| T-05 | 같은 기간 다른 세션 | S1(최신)·S2 각각 확인 필요 행 | 카드·표는 S1만 | Pending |
| T-06 | tenant 격리 | tenant B sessionId + `source=needs_decision` 주입 | sessionId strip. **확인 필요 행 0건**(기간 전체 fallback 금지). 타 tenant 행 0 | Pending |
| T-07 | 사업장 격리 | 다른 client sessionId + needs_decision | 동일: strip + **0행** 빈 상태 | Pending |
| T-08 | period 불일치 | 세션 period와 다른 period + sessionId + needs_decision | 동일: strip + **0행** 빈 상태 | Pending |
| T-09 | 무효 sessionId | 없는 UUID + needs_decision | sessionId strip. **확인 필요 필터 0행 빈 상태만**. 기간 전체 원장 미표시(Brief §4.3) | Pending |
| T-10 | sessionId 없는 원장 진입 | `/reconciliation-ledger?period=P` only | **기존 기간 전체 동작 회귀** | Pending |
| T-11 | 파일 CTA 회귀 | CUI-4 파일 카드 CTA | 여전히 `direct-upload?period&sessionId`. 원장으로 바뀌지 않음 | Pending |
| T-12 | mutation 없음 | 세비서 거래 카드·CTA | 확정/제외/재분석 제어 없음. navigation only | Pending |
| T-13 | 권한·비로그인 | 세션 없음 | `/sign-in` 또는 기존 dashboard 가드 | Pending |
| T-14 | 로딩·오류 | read model 실패 fixture | 사용자 안전 문구. 타 tenant 데이터 미노출 | Pending |

## 4. Regression

- [ ] QA 13 R-01~R-12 파일 카드 회귀(단위/기존 evidence)
- [ ] 자료대조원장 일반 진입·기존 `source` 탭
- [ ] 자료수집 `sessionId` deep link (CUI-4)

## 5. Notes

- **T-04**가 CUI-4d 핵심 계약이다. Preview HTML만으로는 불충분 — runtime 필수.
- **T-06~T-09**는 동일 fail-closed: deep link 검증 실패 시 **기간 전체 fallback 없이 0행**.
- status 집합은 Brief OD-4d-2: `suggested` \| `needs_decision` \| `unclassified`.
- S2 Preview 미승인 시 runtime 착수하지 않는다(Brief §9). #287은 Draft 유지.
- 확인 환경: 로컬 우선. staging은 당분간 기본 QA 경로로 쓰지 않는다.
