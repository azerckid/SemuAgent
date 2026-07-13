# JC-030 Annual Wage Statement Stage A — Official Submission Route Audit
> Created: 2026-07-14 KST
> Last Updated: 2026-07-14 KST

## 0. Flow Status

```text
[Flow]
대상: 연말정산 검토 화면과 구분되는 `근로소득 지급명세서` 신고 산출물
공식 확인: 홈택스는 직접작성제출 또는 자체 프로그램 전자파일 변환제출을 안내
판정: 공식 비암호화 업로드 양식은 확인되지 않음 → **Path 1b 대상**
현재: Stage A 공식 경로 감사 + Stage B 법정 필드/canonical 공백 매핑 완료 · Preview/runtime 미착수
다음: Annual Stage C 신뢰 가능한 연말정산 결과 정본 취득·확정 계약
차단: 현재 연간 지급액·기납부세액만으로 전체 지급명세서 값을 추정하거나 화면을 먼저 제작하지 않음
조건부 후순위: 사업장현황신고는 면세 개인사업자에게만 적용되므로 별도 대상성 gate 뒤 진행
제외: 회계프로그램 변환파일·암호화 파일·자동 제출·주민등록번호 DB 저장
```

## 1. Purpose

이 문서는 **근로소득 지급명세서**의 공식 제출 경로를 확인하고, JC-030 Path 1a/1b
중 어느 경로가 맞는지 판정한다.

다음 세 가지를 혼동하지 않는다.

1. **근로소득 간이지급명세서** — 반기 지급액을 신고하는 별도 세목이며 현재 Path 1b
   직접작성 값 화면이 구현돼 있다.
2. **연말정산 준비·검토** — 현재 `/dashboard/filing-preparation/year-end-settlement`이
   제공하는 연간 지급액·기납부 원천세·급여 누락 검토다. 정산세액을 계산하지 않는다.
3. **근로소득 지급명세서** — 연말정산 결과를 포함해 원천징수의무자가 홈택스에 제출하는
   연간 신고 산출물이다. 이 문서의 JC-030 대상이다.

Stage A는 공식 경로만 판정한다. [Stage B Mapping](./56_JC030_ANNUAL_WAGE_STATEMENT_FIELD_MAPPING.md)은
현행 제24호서식 전체와 현재 DB를 대조했고, 완전한 연말정산 결과 정본이 없어 UI-First
Gate를 열 수 없다고 판정했다. 실제 직접입력 화면은 Stage C가 신뢰 source를 확정한 뒤
별도 작업으로 만든다.

## 2. Official Evidence

### 2.1 2025 Year-End Settlement Official Page

2026-07-14 확인한 국세청 공식 페이지:

- 2025년 귀속 연말정산 종합 안내:
  https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=238938&mi=6645

이 페이지는 원천징수의무자 신고안내, 법정 서식, 홈택스 제출방법 자료를 함께 제공한다.
제3자 블로그나 화면 캡처가 아니라 국세청이 현재 연결하는 공식 자료를 근거로 사용한다.

### 2.2 Official Withholding-Agent Guide

- 문서: `2025년 귀속 원천징수의무자를 위한 신고안내`
- 공식 다운로드:
  https://nts.go.kr/comm/nttFileDownload.do?fileKey=b63fd12eec36895fef98e8222a6fb9b0
- 확인일: 2026-07-14
- SHA-256:
  `b76fe7dfbe194f3e3e2a46e03df5f2f2faaa326cb1afecb559d8df4764112aab`
- 형식: PDF, 28 pages, not encrypted

공식 안내의 홈택스 경로:

```text
지급명세·자료·공익법인
→ (근로·사업 등) 지급명세서 제출
→ 지급명세서 제출/내역조회
```

공식 안내는 제출 방법을 다음 두 가지로 구분한다.

1. 홈택스 화면의 **직접작성제출방식**
2. 자체 프로그램으로 만든 전자파일의 **변환제출방식**

전자파일은 국세청 전산매체 제출요령을 따라야 한다. 이는 공식 Excel·CSV 양식에 값을
채워 그대로 업로드하는 Path 1a와 다르며, 현재 제품에서 제외한 회계프로그램
변환파일·인증/암호화 경로를 다시 여는 근거로 사용하지 않는다.

### 2.3 Statutory HWP Forms Are Not Upload Templates

- 자료: `2025년 귀속 연말정산 주요서식 모음`
- 공식 다운로드:
  https://nts.go.kr/comm/nttFileDownload.do?fileKey=41428acf95e8cab03a4ba3f514334b91
- 확인일: 2026-07-14
- SHA-256:
  `9a81b1d4a10c837479dd708fe450e998f21f709ce5652b62b6ce2fd3cc8e34e2`

압축 파일에는 `[별지 제24호서식] 근로소득 원천징수영수증, 근로소득 지급명세서` HWP가
포함돼 있다. 이 법정 서식은 필드 의미를 확인하는 근거지만, 홈택스가 HWP를 직접
업로드받는다는 증거가 아니다. 따라서 HWP/PDF 서식의 존재만으로 Path 1a를 판정하지
않는다.

## 3. Stage A Verdict

**판정: 근로소득 지급명세서는 현재 확인된 공식 경로 기준 Path 1b 대상이다.**

- 직접작성제출방식은 공식 확인됐다.
- 자체 프로그램 변환제출방식은 존재하지만 현재 제품 범위 밖이다.
- 홈택스가 직접 내려주고 다시 업로드받는 공식 비암호화 Excel/폼 양식은 확인되지 않았다.
- 법정 HWP는 업로드 양식으로 간주하지 않는다.

따라서 SemuAgent는 공식 변환파일 포맷을 추정하거나 기존 간이지급 파일 후보를
재사용하지 않는다. Stage B에서 정확한 직접입력 필드와 정본을 확인한 뒤 Path 1b
화면을 만든다.

향후 국세청이 공식 비암호화 업로드 원본과 직접 수용 메뉴를 제공하는 사실이 확인되면
그때 별도 Stage A 재감사를 거쳐 Path 1a 승격 여부를 검토한다.

## 4. Current Canonical Data Audit

현재 `lib/payment-statements/summary.ts`의 연말정산 read model은 준비·검토 목적이며,
근로소득 지급명세서 전체 작성 모델이 아니다.

| 데이터 | 현재 source | 판정 |
|:---|:---|:---|
| 귀속연도·재직 상태·입퇴사일 | 신고 기간·`employee_profile` | 후보 정본 |
| 연간 지급합계 | 월별 `payroll_employee_line.grossPayKrw` 합계 | 후보 정본, 법정 총급여 의미와 Stage B 대조 필요 |
| 기납부 근로소득세 | 월별 `incomeTaxKrw` 합계 | 후보 정본, 결정세액과 구분 필요 |
| 소득자 식별정보 | employee code·이름만 저장 | 주민등록번호는 DB 저장 금지; 홈택스 직접 입력 경계 필요 |
| 비과세 소득 종류·금액 | 전용 canonical field 없음 | 추정 금지 · blocker |
| 근로소득공제·과세표준 | 전용 canonical field 없음 | 역산 금지 · blocker |
| 인적·연금·보험·주택·기타 소득공제 | 전용 canonical field 없음 | 추정 금지 · blocker |
| 산출세액·세액감면·세액공제·결정세액 | 전용 canonical field 없음 | 추정 금지 · blocker |
| 종전근무지·주현근무지 상세 | 전용 canonical field 없음 | 누락 시 blocker 또는 v1 제외 결정 필요 |
| 차감징수세액·환급/추징 | 현재 계산하지 않음 | 홈택스 값 또는 별도 정본 없이는 표시 금지 |

연간 지급합계와 기납부 원천세가 있다는 이유로 나머지 세액·공제 필드를 0이나 계산값으로
만들지 않는다. 현재 연말정산 화면은 계속 **준비·검토 화면**이며, 근로소득 지급명세서
Path 1b 화면으로 표시하지 않는다.

## 5. Stage B Outcome

[Stage B Mapping](./56_JC030_ANNUAL_WAGE_STATEMENT_FIELD_MAPPING.md)은 2025-06-30
개정 제24호서식의 헤더·징수의무자/소득자·근무처별 소득·비과세/감면·세액명세·정산명세·
가족별 공제와 부속명세를 현재 정본과 대조했다.

- 현재 정본으로는 연간 급여대장 합계와 현근무지 기납부세액 일부만 만들 수 있다.
- `grossPayKrw`는 비과세 식대를 포함하므로 법정 총급여나 급여 칸으로 그대로 복사할 수 없다.
- 인적공제·소득/세액공제·과세표준·결정세액·차감징수세액은 정본이 없다.
- 따라서 Stage B 매핑은 완료했지만 UI-First Gate는 **NO-GO**다.

다음은 Stage C에서 신뢰 가능한 연말정산 결과 source, 공용 신고 사업장 profile, PII
처리 경계를 결정하는 작업이다. 그전에는 기존 연말정산 준비·검토 화면을 지급명세서
Path 1b 완료 화면으로 바꾸지 않는다.

## 6. Conditional Business-Status Track

사업장현황신고는 모든 사업자가 아니라 **부가가치세 면세 개인사업자**에게 적용되는
조건부 연간 신고다. 일반 과세 개인사업자와 법인의 공통 다음 작업으로 두지 않는다.

- 대상 사업자 유형을 tenant/client profile에서 확정할 수 있는 gate가 먼저 필요하다.
- 비대상 사업자에게 메뉴·미완료 badge·신고 blocker를 노출하지 않는다.
- 대상 회사 fixture가 준비된 뒤 별도 Stage A를 진행한다.

따라서 현재 보편적 급여 신고 흐름인 근로소득 지급명세서 Stage B를 완료했고, 다음은
Stage C 정본 source 계약이다. 사업장현황신고는 조건부 후순위로 둔다.

## 7. Completion Line

### 7.1 Stage A Complete

- [x] 국세청 공식 현재 자료에서 직접작성·변환제출 경로를 구분했다.
- [x] 공식 비암호화 업로드 양식이 확인되지 않았음을 기록했다.
- [x] 법정 HWP와 직접 업로드 양식을 구분했다.
- [x] 근로소득 지급명세서를 Path 1b 대상으로 판정했다.
- [x] 현재 canonical 데이터 공백을 기록했다.

### 7.2 Stage B Complete

- [x] 현행 제24호서식 입력 영역 전체를 source ownership으로 분류했다.
- [x] 각 필드의 현재 canonical·확장 후보·홈택스 직접입력·정본 필요·v1 제외를 판정했다.
- [x] 정산세액·공제·식별정보 공백을 추정 없이 처리하는 blocker 계약을 고정했다.
- [x] 현재 정본으로는 Preview 제작 불가라는 NO-GO를 기록했다.

### 7.3 Stage C Pending

- [ ] 신뢰 가능한 연말정산 결과 source와 import/확정 책임을 결정한다.
- [ ] 공용 신고 사업장 profile과 PII 비저장 경계를 결정한다.
- [ ] 대표 fixture에서 제24호서식 필드 완전성을 검증한다.
- [ ] 통과 후 UI-First Preview를 프로젝트 오너에게 보고한다.

### 7.4 Path 1b Done

Stage A 문서만으로 세목 완료로 세지 않는다. Stage B, UI-First Gate, Pre-Code,
read model, browser/QA, 문서 closeout을 모두 통과해야 Path 1b 완료다.

## 8. Related Documents

- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Annual Wage Statement Stage B Field Mapping](./56_JC030_ANNUAL_WAGE_STATEMENT_FIELD_MAPPING.md)
- [E-Filing File Generation Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [Payment Statement · Year-end Settlement Pre-Code Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)
- [JC-030 E-Filing File PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Path 1 E2E Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- [Logic Progress / JC-030](../04_Logic_Progress/00_BACKLOG.md)
