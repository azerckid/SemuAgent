# JC-030 VAT Path 1b Pre-Code Brief
> Created: 2026-07-13 KST
> Last Updated: 2026-07-14 KST

## 0. Flow Status

```text
[Flow]
현재: 완료 — 부가세 Path 1b runtime·검증
Gate: HTML Preview·UI-First·Pre-Code·Component Plan 통과
완료: Field Mapping(52), Preview(14), 프로젝트 오너 승인, read model, runtime, 회귀·브라우저 검증
다음: 지방소득세 특별징수 Path 1a — 공식 `B070101-02.xlsx` 원본 입수·구조 고정
제외: 파일 generator, 자동 홈택스 입력·제출, AI 재호출, 신고서 값 추정
```

## 1. Goal

`/dashboard/vat`에서 확정한 부가세 자료를 사용자가 홈택스 일반과세자 정기 확정신고서의
어느 행에 옮겨 적고 비교해야 하는지 한 표로 제공한다. 화면은 홈택스 미리채움 값을
조회하지 않으며, SemuAgent 확정값과 법정 신고서 행 번호만 제공한다.

## 2. Routes and User Flow

```text
/dashboard/vat?period=YYYY-HN
  -> 홈택스 입력값
/dashboard/vat/hometax-input?period=YYYY-HN
  -> 홈택스 미리채움과 행별 비교
  -> 다른 값만 사용자가 수정
  -> (27) 최종 납부(환급)세액은 홈택스에서 확인
```

- 진입 CTA는 기존 부가세 세액 요약 영역에 한 번만 둔다.
- 별도 화면은 read-only 서버 컴포넌트다.
- AI provider, 저장 AI 결과, evidence trace, confidence를 조회하거나 반복 표시하지 않는다.
- mutation, API route, 신규 DB 컬럼, migration은 없다.

## 3. Data Contract

```ts
type VatHometaxInputStatus = 'ready' | 'blocked' | 'empty' | 'stale' | 'unsupported'

type VatHometaxInputRow = {
  formLine: string
  label: string
  description: string
  amountKrw: number | null
  taxKrw: number | null
  mode: 'input' | 'calculated_check' | 'hometax_final_check'
}

type VatHometaxInputSummary = {
  filingType: 'general_regular_final'
  period: { key: string; label: string; startMonth: string; endMonth: string }
  business: { id: string; name: string } | null
  gate: { status: VatHometaxInputStatus; reasons: string[]; sourceRowCount: number }
  rows: VatHometaxInputRow[]
}
```

Zod schema가 다음 불변식을 강제한다.

- `ready`일 때만 입력 행을 노출한다.
- `blocked/empty/stale/unsupported`에서는 과거 snapshot 값을 확정값처럼 노출하지 않는다.
- `(27)`은 금액·세액을 `null`로 두고 `hometax_final_check`만 허용한다.
- 음수 공급가액·세액이나 공급가액+세액 불일치 VAT fact를 집계하지 않는다.

## 4. Source and Scope

같은 tenant·사업장·기간에서 다음 정본만 읽는다.

1. 최신 completed classification run의 확정 VAT evidence row
2. 사용자 확정 `vat_deduction_review`
3. `vat_period_summary` provenance fingerprint와 확정 합계
4. 기존 `VatPackageGate`의 자료수집·자료대조·공제검토·세무판단·provenance 상태

`loadVatSummary`는 `includeStoredTaxTreatmentAi: false`로 사용하고, package gate에도
결정론적으로 계산한 tax-treatment gate를 전달한다. 이 화면 진입으로 AI provider가
호출되지 않는다.

## 5. Deterministic Line Aggregation

- (1): `sale + taxable + tax_invoice`
- (3): `sale + taxable + card/receipt`
- (4): 지원 VAT evidence 중 (1)·(3)에 속하지 않는 과세 매출
- (5): `sale + zero_rated + tax_invoice`
- (6): 지원 VAT evidence 중 (5)에 속하지 않는 영세율 매출
- (9): (1)~(6)의 지원 범위 합계, provenance 매출 합계와 일치해야 함
- (10)/(11): 세금계산서 매입의 일반·고정자산 canonical 구분이 없으면 `unsupported`
- (14): `purchase + card/receipt`
- (15): 지원되는 확정 매입 VAT fact 합계
- (16): 사용자 확정 불공제 전액 + 안분 불공제분
- (17): (15) - (16), 세액은 provenance `inputTaxDeductibleKrw`와 일치해야 함
- ㉰: provenance `payableTaxKrw`
- (84): 확정 면세 매출 공급가액
- (27): 값 없음. 홈택스가 (18)~(26)을 반영한 최종값을 사용자가 확인

고정자산 여부를 계정명·거래처·금액으로 추정하지 않는다. 현재 canonical 구분 없이
세금계산서 매입이 존재하면 `(10)/(11)을 나눌 수 없음`을 표시하고 표 전체를 숨긴다.

## 6. State Precedence

1. `empty`: 사업장 또는 기간 요약·확정 VAT fact가 없음
2. `stale`: 확정 원장 fingerprint와 저장 요약이 달라 재계산 필요
3. `blocked`: 자료수집·자료대조·공제검토·세무판단·provenance 미완료
4. `unsupported`: 고정자산 분리 등 현재 canonical 필드로 만들 수 없는 신고서 행 존재
5. `ready`: 위 조건이 모두 해소되고 행별 합계가 provenance와 일치

## 7. Component and Library Plan

| Component | 방식 | 책임 |
|:---|:---|:---|
| `VatHometaxInputPage` | async server page | tenant session·period URL state·summary load |
| `VatHometaxInputView` | server component | topbar·경로·상태·단일 입력표 |
| `VatHometaxInputState` | 작은 상태 분기 | blocked/empty/stale/unsupported CTA |
| `VatHometaxInputTable` | semantic table | 신고서 위치·금액·세액·확인 방식 |

- 기존 `Link`, `buttonVariants`, Tailwind table/panel 패턴만 재사용한다.
- 신규 shadcn 컴포넌트·상태 관리·form library·table library를 설치하지 않는다.
- desktop은 4열 표, mobile은 한 신고서 행을 한 블록으로 쌓는다.

## 8. Acceptance Criteria

- [x] `/dashboard/vat`에서 같은 기간의 `홈택스 입력값` 화면으로 이동한다.
- [x] tenant·사업장·기간 scoped 확정 VAT fact만 집계한다.
- [x] ready에서 (1)~(17), ㉰, (84), (27) 경계를 한 표로 표시한다.
- [x] blocked/empty/stale/unsupported에서 확정값 표를 숨기고 다음 행동만 표시한다.
- [x] `(27)`을 SemuAgent ㉰ 값으로 표시하지 않는다.
- [x] fixed-asset 구분·특수 조정·금액을 계정명이나 세율로 추정하지 않는다.
- [x] 최초 렌더와 route 진입에서 AI provider 호출이 없다.
- [x] desktop/mobile 브라우저 E2E, tsc, 전체 테스트, lint, whitespace가 통과한다.

브라우저 검증은 승인된 ready Preview의 desktop/mobile 구조와 실제 로그인 runtime의
blocked 상태를 나눠 확인했다. 라이브 샘플의 `확정 원장 출처 393건` blocker에서는
값 표가 렌더링되지 않고 다음 행동만 표시됐으며, desktop과 410px mobile 모두 문서
가로 넘침이 없었다. ready 값 매핑은 동일 계약의 단위·정적 회귀로 검증했다.

## 9. Related Documents

- **Technical_Specs**: [VAT Path 1b Field Mapping](./52_JC030_VAT_PATH1B_FIELD_MAPPING.md)
- **Technical_Specs**: [VAT Confirmed Ledger Provenance](./42_VAT_CONFIRMED_LEDGER_PROVENANCE_AUDIT.md)
- **Technical_Specs**: [Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- **UI_Screens**: [VAT Path 1b Prototype Review](../02_UI_Screens/14_VAT_PATH1B_PROTOTYPE_REVIEW.md)
- **UI_Screens**: [VAT Path 1b Preview](../02_UI_Screens/previews/14_vat_path1b.html)
- **QA_Validation**: [Filing Support Scenarios §2.11](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- **Logic_Progress**: [Backlog / JC-030](../04_Logic_Progress/00_BACKLOG.md)
