# Cadence Navigation Prototype Review
> Created: 2026-07-11 KST
> Last Updated: 2026-07-13 KST

## 1. 결정 목적

작은 회사 사용자는 내부 프로젝트 코드나 신고 준비 단계보다 **언제 해야 하는 일인지**를 먼저 생각한다.
내비게이션은 이 업무 주기에 맞춰 월간 `급여·지급`, 분기·반기 `부가세`, 연간 `연간신고`로 재구성한다.

이번 문서는 화면 계약과 HTML Preview를 먼저 고정한다. 실제 Next.js 사이드바·라우트 변경은 별도 구현 PR에서 진행한다.

## 2. 승인된 정보구조

```text
회사 홈
자료수집
기장검토
  자료대조원장
급여·지급
  직원 명부
  원천세
  지급명세서
  연말정산
  지방소득세
부가세
연간신고
  개인사업자: 종합소득세
  법인사업자: 법인세
  면세 개인사업자: 사업장현황신고
설정
리마인드
```

### 2.1 제거되는 상위 메뉴

| 기존 메뉴 | 처리 | 새 위치 |
|:---|:---|:---|
| 신고지원 | 상위 메뉴 제거 | 원천세·지급명세서는 `급여·지급`, 부가세 준비값은 `부가세`, 연간 세목은 `연간신고`에서 표시 |
| 신고 준비 | 별도 허브 제거 | 회사 홈의 `다가오는 신고`와 각 세목 화면의 준비 상태로 분산 |
| 직원 명부 | 관리 메뉴에서 제거 | `급여·지급` 하위 기준정보 |

## 3. 화면 역할

| 화면 | 사용자가 확인할 것 | 주요 행동 |
|:---|:---|:---|
| 회사 홈 | 가장 가까운 신고 일정과 남은 blocker | 해당 세목으로 이동 |
| 급여·지급 | 월 급여, 원천세, 지방소득세, 지급명세서, 연말정산, 직원 기준정보 | 급여 확정, 신고값 확인, 직원 정보 보완 |
| 부가세 | 분기·반기 매출·매입, 공제·영세율·면세 판단 | AI 판단 확인·수정·확정 |
| 연간신고 | 사업자 유형에 맞는 연간 신고 준비 상태 | 개인/법인/면세 여부에 맞는 세목만 확인 |

`다가오는 신고`는 별도 허브가 아니다. 회사 홈에서 가장 가까운 일정 2~3건과 준비 상태만 보여주는 얕은 스트립이다.

## 4. 조건부 노출

- 법인사업자: `연간신고 > 법인세`
- 일반 개인사업자: `연간신고 > 종합소득세`
- 면세 개인사업자: `연간신고 > 종합소득세`, `사업장현황신고`
- 직원이 없는 사업자도 `급여·지급`은 접근할 수 있으나 빈 상태에서 직원 등록 또는 해당 없음 상태를 안내한다.
- 사용자에게 해당하지 않는 연간 세목을 동시에 나열하지 않는다.

## 5. Preview 매핑

| Preview | 새 역할 |
|:---|:---|
| [04_payroll.html](./previews/04_payroll.html) | 급여·지급 상위 작업공간 |
| [05_filing_support.html](./previews/05_filing_support.html) | 급여·지급 하위 원천세 준비값 |
| [06_employee_directory.html](./previews/06_employee_directory.html) | 급여·지급 하위 직원 명부 |
| [09_payment_year_end.html](./previews/09_payment_year_end.html) | 급여·지급 하위 지급명세서 |
| [15_year_end_settlement.html](./previews/15_year_end_settlement.html) | 급여·지급 하위 연말정산 |
| [10_local_income_tax.html](./previews/10_local_income_tax.html) | 급여·지급 하위 지방소득세 |
| [03_vat.html](./previews/03_vat.html) | 부가세 독립 작업공간 |
| [08_filing_preparation.html](./previews/08_filing_preparation.html) | 연간신고 상위 작업공간 |
| [11_business_status_report.html](./previews/11_business_status_report.html) | 면세 개인사업자 조건부 사업장현황신고 (연간신고 하위에 종합소득세와 함께 노출) |

## 6. 구현 경계

- 이번 slice: 문서, HTML Preview, 역할·active 상태·조건부 노출 계약.
- 후속 slice: 실제 사이드바 메뉴, breadcrumb, 기존 URL redirect 또는 route alias.
- 세액 계산, 신고 엔진, DB schema, 자동 제출은 이번 IA 변경 범위가 아니다.
- 기존 URL은 구현 전까지 유지하며, 메뉴 이동만으로 기능을 삭제하지 않는다.

## 7. Acceptance Criteria

- [x] Preview에서 `신고지원`, `신고 준비`가 상위 메뉴로 노출되지 않는다.
- [x] 직원 명부·원천세·지급명세서·연말정산·지방소득세가 `급여·지급` 아래에 보인다.
- [x] 부가세는 독립 상위 메뉴다.
- [x] 연간신고는 사업자 유형에 맞는 세목만 노출한다.
- [x] 회사 홈에서 `다가오는 신고`를 바로 확인할 수 있다.
- [x] 실제 앱 사이드바·breadcrumb·route가 같은 구조를 사용한다.
- [ ] 기존 `신고지원`·`신고 준비` URL의 이동 정책을 구현하고 회귀 테스트한다.

## 8. Related Documents

- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - cadence 기반 사용자 흐름
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 사이드바·조건부 노출 디자인 계약
- **UI_Screens**: [Filing Support Prototype Review](./07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) - 기존 신고지원 역할의 재배치 기록
- **Technical_Specs**: [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) - 구현 컴포넌트 경계
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - runtime 후속 작업
