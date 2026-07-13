# JC-030 Annual Wage Statement Stage C — Canonical Source, Filing Profile and PII Contract
> Created: 2026-07-14 KST
> Last Updated: 2026-07-14 KST

## 0. Flow Status

```text
[Flow]
대상: 근로소득 지급명세서 Path 1b의 신뢰 source와 책임 경계
완료: 국세청 편리한 연말정산 생성 흐름·현재 DB·PII 정책 대조
정본 결정: 급여 기초자료는 SemuAgent, 공제신고서와 최종 지급명세서는 홈택스
제품 역할: 홈택스 생성에 필요한 회사·직원별 기초자료 준비와 정합성 검증
UI-First Gate: Stage D HTML Preview 제작 가능(GO), runtime은 오너 승인 전 금지
다음: Annual Stage D — 간결한 홈택스 생성 준비 화면 Preview와 오너 확인
금지: 연말정산 세액 자체 계산, 최종 지급명세서 역산, 주민번호·공제 PDF 저장/AI 전송
```

## 1. Purpose

[Stage B Mapping](./56_JC030_ANNUAL_WAGE_STATEMENT_FIELD_MAPPING.md)은 현재 DB만으로
제24호서식 전체 값을 만들 수 없음을 확인했다. Stage C는 그 공백을 임의 세액 계산
엔진으로 채우지 않고, 실제 홈택스 연말정산 흐름에서 어느 시스템이 어떤 값을 책임지는지
결정한다.

이 문서에서 **정본(canonical data)**은 신고에 사용할 최종 확정값을 뜻한다. 비슷해 보이는
급여 합계나 청구정보가 아니라, 해당 신고 단계에서 수정·제출의 기준이 되는 값이어야 한다.

## 2. Official Hometax Workflow Evidence

### 2.1 Sources Checked

- 국세청 [편리한 연말정산 이용방법](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=8070&mi=6646)
- 국세청 동영상 대본 [연말정산 모든 과정을 홈택스를 통해 진행](https://www.nts.go.kr/nts/na/ntt/selectNttInfo.do?mi=6648&nttSn=1330441), 등록 2025-01-20
- 국세청 [지급명세서 제출](https://s.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=8631&mi=12309)
- 홈택스/손택스 [편리한 연말정산 지급명세서 작성관리](https://mob.tbys.hometax.go.kr/jsonAction.do?actionId=UTBYSECC01F001)
- 확인일: 2026-07-14

### 2.2 Facts Used by This Contract

국세청은 회사의 환경에 따라 여러 연말정산 방식을 안내한다. 유형 5는 홈택스에서
공제자료 수집, 공제신고서 확인, 지급명세서 생성과 제출을 모두 처리하는 회사 흐름이다.
SemuAgent v1은 별도 세액 계산 엔진을 만들지 않고 이 공식 흐름을 기준으로 한다.

홈택스 생성 흐름은 다음 사실을 요구한다.

1. 회사가 근로자 기초자료를 등록한다.
2. 근로자가 공제신고서와 간소화자료를 제출하고 회사가 확인 완료한다.
3. 홈택스가 기초자료와 공제신고서를 결합해 근로소득 지급명세서를 생성한다.
4. 회사가 생성 결과를 확인하고 필요한 경우 홈택스 화면에서 수정한다.
5. 회사가 별도의 제출 동작을 해야 최종 접수된다.

국세청 안내가 열거하는 회사 기초자료에는 성명·식별정보, 연금·보험료, 회사 일괄징수
기부금, 비과세 항목, 감면기간/대상, 기납부 소득세·지방소득세·농어촌특별세 등이 포함된다.

따라서 SemuAgent가 제24호서식의 결정세액과 공제액을 별도로 계산할 필요가 없다. 회사가
홈택스에 정확한 기초자료를 제공하고 공제신고서를 확인하면, 최종 지급명세서는 홈택스에서
생성·수정된다.

## 3. Canonical Ownership Decision

### 3.1 Three Ownership Layers

| 레이어 | 소유 시스템 | 범위 | SemuAgent 처리 |
|:---|:---|:---|:---|
| 회사 급여 기초자료 | SemuAgent | 확정 월 급여, 근무기간, 일부 비과세, 연금·보험료, 기납부 소득세·지방소득세 | 직원별로 집계·검증해 홈택스 입력 준비값으로 표시 |
| 근로자 공제·민감정보 | 홈택스 | 주민/외국인등록번호, 가족별 공제, 간소화자료, 계좌·주택·의료·교육·기부 세부자료 | 앱에 수집·저장하지 않고 홈택스에서 직접 제출·확인 |
| 최종 정산·지급명세서 | 홈택스 | 공제, 과세표준, 산출/결정세액, 차감징수세액, 최종 제24호서식 | 앱이 계산·역산·복제하지 않음. 생성 결과를 홈택스에서 확인·수정·제출 |

### 3.2 v1 Canonical Result Contract

v1의 최종 근로소득 지급명세서 정본은 **홈택스 편리한 연말정산에서 생성되고 회사가
확인한 결과**다. SemuAgent DB에 제24호서식 전체 결과를 복제하지 않는다.

- 외부 급여 프로그램 결과를 자동으로 신뢰하지 않는다.
- 홈택스 생성 PDF/HWP를 SemuAgent에 업로드받아 파싱하지 않는다.
- 급여 합계에서 총급여·과세표준·결정세액을 역산하지 않는다.
- AI가 공제나 세액 숫자를 생성하지 않는다.
- 제출 후에는 기존 신고지원 원칙에 따라 접수증 메타데이터만 별도 보관할 수 있다.

공식 machine-readable 결과 export가 확인되고 별도 PII·무결성 검토를 통과하기 전에는
최종 지급명세서 import 테이블을 만들지 않는다.

## 4. Filing Business Profile Contract

### 4.1 Ownership

`tenant_billing_profile`은 수동 세금계산서·파일럿 청구 정보이므로 신고 정본으로 사용하지
않는다. `client`도 사업자 유형과 이름/주소 일부만 보유한다. 후속 구현은 청구 도메인과
분리된 **사업장별 신고 profile**을 새 도메인으로 둔다.

제안 이름은 `client_filing_profile`이며 Stage C에서는 계약만 고정하고 migration은 만들지
않는다.

| 필드 | 필수 | 규칙 |
|:---|:---:|:---|
| `tenantId`, `clientId` | Y | tenant·사업장 scope, `(tenantId, clientId)` unique |
| `businessRegistrationNumber` | Y | 사업자등록번호. 주민등록번호 대체 금지 |
| `businessName` | Y | 원천징수의무자 상호/법인명 |
| `representativeName` | Y | 대표자명 |
| `businessAddress` | Y | 신고 기준 소재지 |
| `businessUnitTaxStatus` | Y | `not_applicable` / `main` / `branch` |
| `subBusinessSerialNumber` | 조건부 | 종사업장일 때만 허용 |
| `confirmedByStaffId`, `confirmedAt` | Y | 사용자가 신고용 정보임을 확인한 감사 필드 |
| `createdAt`, `updatedAt` | Y | 변경 이력 기준 |

개인 원천징수의무자의 주민등록번호가 필요한 경우에는 profile에 저장하지 않고 홈택스에서
직접 입력한다. 사업자등록번호가 없는 개인까지 지원하려면 별도 보안·법무 검토가 필요하다.

## 5. PII and Document Boundary

### 5.1 Never Persist or Upload in v1

- 주민등록번호·외국인등록번호 원문
- 가족 구성원의 이름·식별번호와 관계
- 계좌번호, 주택·의료·교육·기부 등 공제증빙 원문
- 연말정산간소화 PDF와 공제신고서 PDF
- 홈택스가 생성한 개인별 지급명세서 PDF/HWP
- 위 내용을 포함한 prompt, AI 응답, 로그, 오류 payload

직원 명부의 최소 PII 원칙은 그대로 유지한다. Stage D 화면은 주민등록번호 입력 UI나 파일
업로드 UI를 만들지 않고, 해당 정보는 홈택스에서 직접 입력·제출하도록 안내한다.

### 5.2 Allowed in the Read Model

- 내부 직원 식별자인 `employeeProfileId`·사번·이름
- 근무기간과 재직 상태
- 확정된 급여 항목별 연간 합계
- 확정된 연금·보험료와 기납부 세액 합계
- 값의 source row 수, 기간, 마감 상태, 계산 fingerprint

이 값들은 화면을 그릴 때 기존 정본에서 다시 계산한다. Stage D Preview 승인 전에는 새 저장
테이블이나 mutation을 만들지 않는다.

## 6. Stage D UI Contract

Stage C는 **전체 제24호서식 값 화면**을 승인하지 않는다. 다음 Preview는 홈택스에서
지급명세서를 생성하기 전, 회사가 준비해야 할 기초자료만 간결하게 보여주는 화면이다.

### 6.1 First View

1. 상단 한 줄: `홈택스 편리한 연말정산에서 지급명세서를 생성합니다.`
2. 공식 흐름 한 줄: `기초자료 등록 → 공제신고서 확인 → 지급명세서 생성 → 확인·수정 → 제출`
3. 직원 표: 직원, 근무기간, 급여 준비값, 홈택스 확인 항목, 상태
4. 상태는 `급여 준비 완료`, `급여 보완`, `특례 확인` 세 종류만 사용

### 6.2 Row Detail

행을 열었을 때만 다음 값을 표시한다.

- 기본급·상여/기타수당·비과세 식대 등 현재 분리 가능한 지급 항목
- 국민연금·건강보험·장기요양·고용보험
- 기납부 소득세·지방소득세
- 근무기간과 중도퇴사 여부
- 홈택스 직접 확인: 주민번호, 공제신고서, 종전근무지, 기타 비과세·감면·농특세

### 6.3 Explicitly Excluded from the Preview

- 제24호서식 9쪽 전체 표
- 공제·과세표준·결정세액·환급/추징 숫자
- 주민등록번호 입력·파일 업로드
- 자동 계산·AI 계산·자동제출 버튼
- 반복 체크리스트·대형 안내 카드·동일 정보의 중복 요약

## 7. Readiness and Validation Contract

직원 행은 다음 조건을 모두 만족할 때만 `급여 준비 완료`다.

1. 귀속연도에 필요한 모든 월 급여가 `closed` 또는 신고에 사용할 확정 상태다.
2. 직원 명부와 급여 line이 내부 직원 식별자로 연결된다.
3. 근무기간과 중도퇴사 여부가 확정됐다.
4. 지급 항목 합계와 `grossPayKrw`의 관계가 설명 가능하다.
5. 연금·보험료와 기납부 세액이 확정 source에서 집계된다.

다음은 `특례 확인`이며 `급여 준비 완료`로 숨기지 않는다.

- 종전근무지, 외국인 단일세율, 국외근로, 특수 감면
- 회사 일괄징수 기부금, 농어촌특별세
- 비과세 식대 외의 코드별 비과세·감면소득
- 현재 스키마가 존재 여부를 확인할 수 없는 항목

`급여 준비 완료`는 최종 연말정산 완료가 아니다. 홈택스 공제신고서 확인과 지급명세서
생성·검토·제출이 남아 있음을 화면에서 분명히 표시한다.

## 8. Stage C Verdict

### 8.1 Decisions Complete

- 최종 지급명세서 정본: 홈택스 생성·회사 확인 결과
- SemuAgent 책임: 회사·직원별 급여 기초자료 준비와 정합성 검증
- 신고 사업자 정보: 청구 profile과 분리된 `client_filing_profile` 후속 설계
- PII: 주민번호·가족·계좌·공제증빙·개인별 결과 문서 미수집/미저장
- 세액 엔진: v1 미도입, 별도 법무·세무 검토 epic 필요

### 8.2 UI-First Gate

Stage D **HTML Preview 제작은 GO**다. 다만 이 승인은 위 §6의 간결한 홈택스 생성 준비
화면에만 적용된다. 프로젝트 오너가 Preview를 확인하기 전 runtime·schema·migration·API를
구현하지 않는다.

## 9. Completion Line

### 9.1 Stage C Complete

- [x] 국세청 편리한 연말정산의 기초자료→공제신고서→생성→수정→제출 흐름을 확인했다.
- [x] 급여 기초자료와 최종 지급명세서 정본의 소유 시스템을 분리했다.
- [x] 신고 사업장 profile을 billing profile과 분리했다.
- [x] 주민번호·공제증빙·개인별 결과 문서 미저장 경계를 고정했다.
- [x] 세액 계산 엔진과 결과 문서 import를 v1에서 제외했다.
- [x] Stage D Preview의 최소 화면과 금지 요소를 고정했다.

### 9.2 Stage D Pending

- [ ] [Payment/Year-end Preview](../02_UI_Screens/previews/09_payment_year_end.html) 또는 별도 Preview에 승인 범위를 시각화한다.
- [ ] 직원 표의 정보 밀도와 행 상세 구조를 프로젝트 오너에게 확인받는다.
- [ ] 오너 승인 후 Screen Flow·UI Design·Pre-Code Brief를 동기화한다.
- [ ] 그 뒤에만 read model 확장과 `client_filing_profile` migration 여부를 결정한다.

## 10. Related Documents

- [Annual Wage Stage A Audit](./55_JC030_ANNUAL_WAGE_STATEMENT_STAGE_A_AUDIT.md)
- [Annual Wage Stage B Field Mapping](./56_JC030_ANNUAL_WAGE_STATEMENT_FIELD_MAPPING.md)
- [Payment Statement · Year-end Settlement Pre-Code Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)
- [E-Filing PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- [Logic Progress / JC-030](../04_Logic_Progress/00_BACKLOG.md)
