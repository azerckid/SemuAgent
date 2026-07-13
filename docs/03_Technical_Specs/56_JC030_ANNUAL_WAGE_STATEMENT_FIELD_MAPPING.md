# JC-030 Annual Wage Statement Stage B — Field Mapping and Canonical Data Gap Contract
> Created: 2026-07-14 KST
> Last Updated: 2026-07-14 KST

## 0. Flow Status

```text
[Flow]
대상: 근로소득 지급명세서 Path 1b 직접작성 값 정리
공식 기준: 소득세법 시행규칙 별지 제24호서식(1), 2025-06-30 개정
완료: Stage B 법정 필드 그룹 ↔ 현재 canonical source·홈택스 입력·정본 공백 매핑
Stage B 판정: 현재 DB만으로 완전한 지급명세서 값을 만들 수 없음 → UI-First Gate NO-GO
Stage C 완료: 급여 기초자료는 SemuAgent, 공제신고서·최종 지급명세서는 홈택스 정본
다음: Annual Stage D — 간결한 기초자료 준비 HTML Preview·오너 승인
유지: 기존 연말정산 화면은 연간 지급·기납부세액 준비 검토 전용
금지: 총지급액·기납부세액에서 공제·과세표준·결정세액·환급/추징 역산
제외: 변환파일·암호화 파일·자동제출·주민등록번호 서버 저장
```

## 1. Purpose

[Stage A Audit](./55_JC030_ANNUAL_WAGE_STATEMENT_STAGE_A_AUDIT.md)은 근로소득
지급명세서를 Path 1b 대상으로 판정했다. 이 문서는 현행 법정 서식의 모든 입력 영역을
현재 SemuAgent 데이터와 대조해, 지금 정직하게 제공할 수 있는 값과 선행 정본이 필요한
값을 분리한다.

이 문서의 완료는 **화면 구현 승인**이 아니다. 매핑 결과가 `source_required`이면 해당
값을 0·빈칸·추정값으로 대신하지 않고, 정본 취득 계약이 끝날 때까지 Preview와 runtime을
시작하지 않는다.

## 2. Official Field Baseline

### 2.1 Current Statutory Form

- 서식: 소득세법 시행규칙 별지 제24호서식(1)
- 제목: 근로소득 원천징수영수증 / 근로소득 지급명세서
- 개정: 2025-06-30
- 공식 PDF:
  https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110202&flSeq=154131663&gubun=
- 확인일: 2026-07-14
- SHA-256:
  `636624805bbd6104c54ce3122536b783c0c7ee646bff5b9ba89f71baa8205de7`
- 형식: PDF, 28 pages, not encrypted. 근로소득 지급명세서 부분은 9 pages.

Stage A에서 확보한 국세청 `2025년 귀속 연말정산 주요서식 모음`의 HWP도 같은 별지
제24호서식을 포함한다. HWP와 PDF는 법정 필드의 근거이며 업로드 양식이 아니다.

### 2.2 Mapping Status Codes

| 코드 | 의미 | 화면 처리 |
|:---|:---|:---|
| `canonical_now` | 현재 확정 테이블과 scope에서 바로 읽을 수 있음 | 동일 read model에서 표시 가능 |
| `canonical_extend` | 저장 필드는 있으나 현재 연말정산 read model이 읽지 않거나 법정 의미 확인이 더 필요 | read model 확장·검증 뒤 표시 |
| `hometax_direct` | PII 또는 사용자 선택값으로 앱에 저장하지 않고 홈택스에서 직접 입력·확인 | 값 대신 입력 항목과 책임 경계만 안내 |
| `source_required` | 현재 정본 없음. 확정된 연말정산 결과 또는 별도 신뢰 source 필요 | blocker. 0·빈칸·역산 금지 |
| `v1_excluded` | v1 지원 범위를 벗어나는 특례·복합 사례 | 해당 소득자 전체를 지원 완료로 표시하지 않고 별도 처리 안내 |

`canonical_extend`는 저장 필드가 있다는 뜻일 뿐 법정 입력값으로 곧바로 쓸 수 있다는
뜻이 아니다. 합계·분류·기간·현재/종전 근무처 의미를 검증해야 `canonical_now`로 승격한다.

## 3. Current Canonical Inventory

### 3.1 Available Today

| 데이터 | Source | 상태 |
|:---|:---|:---|
| 귀속연도 | 신고 context | `canonical_now` |
| 소득자 이름·사번 | `employee_profile`, `payroll_employee_line` | `canonical_now` |
| 재직·휴직·퇴사 상태, 입사일·퇴사일 | `employee_profile` | `canonical_now` |
| 월별 총지급액 | `payroll_employee_line.grossPayKrw` | `canonical_now`, 법정 총급여와 동일하지 않음 |
| 월별 기납부 근로소득세 | `payroll_employee_line.incomeTaxKrw` | `canonical_now`, 결정세액과 구분 |
| 월별 지방소득세 | `payroll_employee_line.localIncomeTaxKrw` | `canonical_extend` |
| 국민연금·건강보험·장기요양·고용보험 | `payroll_employee_line` 각 확정액 | `canonical_extend` |
| 기본급·비과세 식대·기타수당 | `payroll_employee_line` | `canonical_extend`, 법정 급여/상여/비과세 코드 완전 분리는 아님 |
| 공제대상가족수 | `payroll_employee_line.dependentCount` | 간이세액표용 숫자일 뿐 연말정산 인적공제 정본이 아님 |

### 3.2 Not Filing Canonical

`tenant_billing_profile`의 사업자등록번호·대표자·주소는 **청구 주체 정보**다. 세금계산서
발행과 파일럿 청구를 위한 테이블이므로 지급명세서 신고 주체 정본으로 재사용하지 않는다.
`client.name/address`도 사업장 이름·주소 후보일 뿐 대표자·사업자등록번호·사업자단위과세
상태를 완성하지 못한다. Stage C에서 공용 신고 사업장 profile의 ownership을 별도로
결정해야 한다.

## 4. Complete Field Mapping

아래 표는 현행 제24호서식(1)의 9쪽을 기능 영역별로 전부 포함한다. 개별 공제의 세부
하위행은 같은 source ownership을 공유하므로 그룹으로 묶되, 생략하거나 0으로 간주하지
않는다.

### 4.1 Header, Withholding Agent, Employee Identity

| 공식 영역 | 필드 | 현재 source | 판정 |
|:---|:---|:---|:---|
| 문서 헤더 | 관리번호, 영수증/지급명세서, 보관용/보고용 | 홈택스 제출 context | `hometax_direct` |
| 소득자 구분 | 거주구분·거주지국/코드·내외국인·국적/코드 | 없음 | `hometax_direct`; 앱 추정 금지 |
| 소득자 특례 | 외국인 단일세율·외국법인 파견·종교관련 여부 | 없음 | `hometax_direct`; 해당 시 `v1_excluded` 검토 |
| 가구·정산 구분 | 세대주 여부·계속근로/중도퇴사 | 퇴사 상태 일부만 존재 | 퇴사 여부 `canonical_now`, 나머지 `hometax_direct` |
| 징수의무자 ①~⑤ | 상호·대표자·사업자등록번호·주민등록번호·소재지 | 이름/주소 일부만 존재 | 공용 신고 사업장 `source_required` |
| 사업장 특례 ③-1~③-2 | 사업자단위과세 여부·종사업장 일련번호 | 없음 | `source_required`; 해당 시 명시적 확인 |
| 소득자 ⑥ | 성명 | 직원 명부 | `canonical_now` |
| 소득자 ⑦~⑧ | 주민/외국인등록번호·주소 | 정책상 미저장 | `hometax_direct`; 서버·로그 저장 금지 |

### 4.2 Workplace Income and Non-taxable/Reduced Income

| 공식 영역 | 필드 | 현재 source | 판정 |
|:---|:---|:---|:---|
| 현 근무처 ⑨~⑫ | 근무처명·사업자등록번호·근무기간·감면기간 | 사업장명·입퇴사일 일부 | `canonical_extend` + 신고 사업장 `source_required` |
| 종전 근무처 | 근무처명·사업자등록번호·근무/감면기간 | 없음 | `source_required`; 부재를 자동으로 0건 처리 금지 |
| 근로소득 ⑬~⑮ | 급여·상여·인정상여 | 최종 line은 총지급·기본급·수당만 보유 | 법정 분류 결과 `source_required` |
| 특수 근로소득 | 주식매수선택권·우리사주 인출·임원 퇴직소득 한도초과·직무발명보상 | 없음 | 해당 소득자는 `v1_excluded` 또는 별도 정본 필요 |
| 비과세·감면 | 국외근로·야간근로·보육·출산지원·연구보조비 등 코드별 금액 | 비과세 식대만 분리 저장, 나머지 불완전 | 전체 코드별 정본 `source_required`; P01 식대만 `canonical_extend` 후보 |
| 비과세/감면 합계 | 비과세소득 계·감면소득 계 | 코드별 완전 데이터 없음 | `source_required`; `grossPayKrw`에서 임의 차감 금지 |

`grossPayKrw`는 지급계에 비과세 식대를 포함한다. 따라서 이를 법정 `총급여`나 ⑬ 급여로
그대로 복사하지 않는다. `payroll_extraction_row`의 세부 수당은 검토 후보 원천이며 최종
정본인 `payroll_employee_line`에서 모든 법정 코드가 보존되지 않으므로 보완 source가 필요하다.

### 4.3 Tax Statement

| 공식 영역 | 필드 | 현재 source | 판정 |
|:---|:---|:---|:---|
| 결정세액 | 소득세·지방소득세·농어촌특별세 | 없음 | `source_required` |
| 종전근무지 기납부세액 | 세목별 세액·사업자등록번호 | 없음 | `source_required` |
| 현근무지 기납부세액 | 소득세·지방소득세 | 월별 확정 line | `canonical_extend`; 귀속·지급·현근무지 범위 검증 필요 |
| 현근무지 농어촌특별세 | 농어촌특별세 | 없음 | `source_required` |
| 납부특례세액 | 세목별 특례세액 | 없음 | 해당 시 `v1_excluded` |
| 차감징수세액 | 결정세액 - 기납부 - 납부특례 | 결정세액 없음 | `source_required`; 앱 산식 생성 금지 |

현재 `annualWithholdingTaxKrw`는 현근무지에서 월별로 원천징수한 소득세 합계 후보다.
이는 결정세액·차감징수세액·환급액이 아니다.

### 4.4 Settlement Details and Deductions

| 공식 영역 | 세부 필드 그룹 | 현재 source | 판정 |
|:---|:---|:---|:---|
| 소득 계산 | 총급여·근로소득공제·근로소득금액·차감소득금액 | 총지급액만 존재 | `source_required`; 역산 금지 |
| 기본/추가 인적공제 | 본인·배우자·부양가족·경로우대·장애인·부녀자·한부모 | 간이세액표용 가족수만 존재 | `source_required`; `dependentCount` 재사용 금지 |
| 연금보험료 | 국민연금·공무원/군인/사학/별정우체국 연금 | 국민연금 일부 존재 | 국민연금 `canonical_extend`, 나머지 `source_required` |
| 특별소득공제 | 건강/장기요양·고용보험·주택자금 | 보험료 일부 존재 | 보험료 `canonical_extend`, 주택자금 `source_required` |
| 그 밖의 소득공제 | 개인연금저축·소기업공제·주택마련저축·투자조합·신용카드·우리사주·고용유지·장기집합투자 | 없음 | `source_required` |
| 과세·산출 | 소득공제 한도초과·종합소득 과세표준·산출세액 | 없음 | `source_required`; 계산 엔진 없음 |
| 세액감면 | 소득세법·조특법·중소기업 취업자·조세조약 등 | 없음 | `source_required`; 특례는 자동 확정 금지 |
| 세액공제 | 근로·혼인·자녀·연금계좌·보험·의료·교육·기부·표준·납세조합·주택차입·외국납부·월세 | 없음 | `source_required` |
| 최종 세액 | 세액공제 계·결정세액·실효세율 | 없음 | `source_required` |

### 4.5 Itemized Deduction Statements and Attachments

| 공식 영역 | 필드 | 현재 source | 판정 |
|:---|:---|:---|:---|
| 소득·세액공제 명세 | 가족별 관계·성명·주민번호·인적공제·보험·의료·교육 | 없음 | `source_required` + PII는 `hometax_direct` |
| 사용액 명세 | 신용/직불카드·현금영수증·문화체육·전통시장·대중교통·소비증가분 | 없음 | 홈택스 간소화/확정 결과 `source_required` |
| 기부금 명세 | 유형별 공제대상금액·세액공제액 | 없음 | `source_required` |
| 연금·저축 명세 | 계좌 유형·금융기관·계좌번호·납입·공제액 | 없음 | `source_required`; 계좌번호 앱 저장 금지 검토 |
| 주택 관련 명세 | 월세·임차차입·장기주택저당차입금 | 없음 | `source_required` |
| 추가 제출서류 | 의료비·기부금·주택·연금/저축 등 해당 명세 | 없음 | 홈택스 제출 여부 확인; 누락 시 blocker |

## 5. Supported-v1 Boundary

### 5.1 What Can Be Shown Without a New Settlement Source

현재 정본만으로는 다음 준비 정보까지만 정직하게 제공할 수 있다.

1. 귀속연도와 직원별 재직·입퇴사 상태
2. 월 급여가 모두 확정됐는지
3. 직원별 연간 총지급액(법정 총급여가 아닌 급여대장 합계)
4. 현 근무지에서 월별로 원천징수한 소득세 합계
5. 일부 사회보험료와 비과세 식대의 후보 합계

이 범위는 현재 `/dashboard/filing-preparation/year-end-settlement`의 **연말정산
준비·검토** 책임과 일치한다. 이를 근로소득 지급명세서 Path 1b 완료 화면으로 이름만
바꾸지 않는다.

### 5.2 Cases Not Silently Supported

다음 사실이 하나라도 존재하거나 존재 여부를 확인할 수 없으면 해당 소득자를 지원 완료로
표시하지 않는다.

- 종전근무지·복수 사업장·납세조합 소득
- 외국인 단일세율·파견외국법인·종교인·국외근로
- 주식매수선택권·우리사주·임원 퇴직소득 한도초과·특수 감면
- 코드별 비과세/감면 소득이 완전히 확정되지 않은 경우
- 가족별 인적공제와 소득·세액공제 명세가 없는 경우
- 결정세액·차감징수세액과 필수 부속명세가 없는 경우

`v1_excluded`는 값을 빼고 제출해도 된다는 뜻이 아니다. SemuAgent의 현재 지원 범위를
벗어났다는 뜻이며, 홈택스 또는 신뢰 가능한 외부 정산 결과에서 처리해야 한다.

## 6. Stage B Verdict

### 6.1 Mapping Complete

- 현행 제24호서식의 헤더, 징수의무자/소득자, 근무처별 소득, 비과세/감면, 세액명세,
  정산명세, 가족별 공제명세와 부속명세를 모두 source ownership에 배정했다.
- 현재 급여·직원·사업장 스키마가 제공하는 값과 제공하지 않는 값을 구분했다.
- 공제·과세표준·결정세액·환급/추징을 추정하지 않는 blocker 계약을 고정했다.

### 6.2 Stage B UI-First Gate: NO-GO

현재 DB에는 완전한 연말정산 결과가 없으므로 근로소득 지급명세서 Preview/runtime을
만들지 않는다. 지금 화면을 만들면 대부분의 핵심 칸이 비거나, 총지급액과 기납부세액에서
세액을 역산하는 잘못을 피할 수 없다.

Path 1b 판정은 유지한다. 세목이 `blocked`된 것이 아니라 **구현 선행 정본이 없는 상태**였다.
Stage C가 홈택스 생성 결과를 최종 정본으로 확정했으므로 Stage D HTML Preview에 한해
UI-First Gate를 다시 연다. runtime·schema·API는 오너 승인 전 금지한다.

## 7. Annual Stage C — Decision

Stage C의 상세 계약은 [Canonical Source Contract](./57_JC030_ANNUAL_WAGE_STATEMENT_CANONICAL_SOURCE_CONTRACT.md)다.

1. **최종 정본:** 홈택스 편리한 연말정산이 공제신고서와 회사 기초자료를 결합해 생성하고
   회사가 확인한 지급명세서다.
2. **SemuAgent 정본:** 확정 월 급여, 근무기간, 항목별 지급액, 연금·보험료, 기납부
   소득세·지방소득세 등 회사 기초자료다.
3. **사업장 profile:** 청구 profile과 분리한 신고 사업장 profile 계약을 후속 구현한다.
4. **PII 경계:** 주민/외국인등록번호, 가족·계좌·공제증빙, 최종 PDF/HWP는 홈택스에서
   직접 처리하고 SemuAgent에 수집·저장하지 않는다.
5. **비계산 원칙:** 전체 연말정산 계산 엔진, 결과 역산, AI 세액 생성, 최종 결과 import를
   v1에 도입하지 않는다.

## 8. Completion Line

### 8.1 Stage B Complete

- [x] 현행 공식 제24호서식 버전·출처·hash를 고정했다.
- [x] 법정 입력 영역 전체를 source ownership으로 분류했다.
- [x] 현재 DB/read model의 canonical coverage를 코드와 대조했다.
- [x] 정본이 없는 세액·공제 필드의 추정 금지 계약을 고정했다.
- [x] Preview/runtime은 아직 만들 수 없다는 NO-GO를 기록했다.

### 8.2 Stage C Complete

- [x] 홈택스 생성 결과를 최종 지급명세서 정본으로 결정했다.
- [x] SemuAgent 급여 기초자료와 홈택스 공제·정산 결과 ownership을 분리했다.
- [x] 공용 신고 사업장 profile ownership을 결정했다.
- [x] 주민번호·가족·공제증빙·최종 결과 문서의 비수집·비저장 경계를 확정했다.
- [x] 전체 세액 계산·역산·AI 생성·결과 import를 v1에서 제외했다.

### 8.3 Stage D Pending

- [ ] 간결한 기초자료 준비 HTML Preview를 제작한다.
- [ ] 프로젝트 오너 승인 후에만 Pre-Code·read model·runtime·QA로 이동한다.

## 9. Related Documents

- [Annual Wage Statement Stage A Audit](./55_JC030_ANNUAL_WAGE_STATEMENT_STAGE_A_AUDIT.md)
- [Annual Wage Statement Stage C Canonical Source Contract](./57_JC030_ANNUAL_WAGE_STATEMENT_CANONICAL_SOURCE_CONTRACT.md)
- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [E-Filing File Generation Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [Payment Statement · Year-end Settlement Pre-Code Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)
- [JC-030 E-Filing File PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Path 1 E2E Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- [Logic Progress / JC-030](../04_Logic_Progress/00_BACKLOG.md)
