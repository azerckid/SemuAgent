# JC-030 — 근로소득 간이지급명세서 Path 1b 직접작성 Technical Brief
> Created: 2026-07-07 00:35 KST
> Last Updated: 2026-07-13

## 0. Decision

근로소득 간이지급명세서의 활성 제품 경로는 **Path 1b(홈택스 직접작성 값 정리)** 다.

- 국세청의 현재 공개 제출방법 안내는 홈택스·손택스 **직접작성 제출**과 우편/방문
  제출을 안내한다.
- 전산매체 제출요령 HWP는 고정길이 기술 규격이며, 사용자가 채워 업로드하는 공식
  비암호화 양식으로 확인되지 않았다.
- 과거 회계·급여 프로그램 변환파일 경로는 전자신고 암호를 요구하므로 현재 제품
  범위 밖이다.
- 따라서 고정길이 plain 후보 파일 생성 UI를 제공하지 않고, 확정 급여에서 파생한
  직접작성 값을 화면에 정리한다.

공식 제출방법:
https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239045&mi=40990

## 1. Product Boundary

포함한다.

1. 홈택스 현재 메뉴 경로와 `직접작성 제출` 진입 안내
2. 신고기간·사업자등록번호·상호·대표자·소득자 수·지급총액 합계
3. 준비 완료 소득자별 근무기간
4. 반기 6개월의 월별 지급액, 지급총액, 인정상여
5. 급여 누락·명부 매칭·월별 합계 불일치 등 입력 전 blocker
6. 식별정보는 홈택스에서 사용자가 직접 입력한다는 안내

제외한다.

- 고정길이 plain 파일 다운로드와 공식 업로드 가능 주장
- 주민등록번호·외국인등록번호 입력 폼 또는 저장
- 세무서코드·담당자·홈택스 ID 수집
- 화면 캡처 기반 클릭별 튜토리얼
- 홈택스 자동 입력·자동 제출·대리 신고
- 암호화 파일·전자신고 암호·fcrypt·적합성 검정

## 2. Current Hometax Route

공개 국세청 안내 기준 경로:

```text
홈택스 로그인
→ 지급명세·자료·공익법인
→ 일용·간이지급명세서/사업장제공자 등의 과세자료 제출명세서 제출(매월·반기)
→ 직접작성 제출
→ 간이지급명세서(근로소득)
```

홈택스 메뉴명은 개편될 수 있다. 런타임 화면은 위 경로와 함께 "최종 입력 전 현재
홈택스 화면의 항목명을 확인"하라는 문구를 표시한다. 자동 이동이나 자동 입력은 하지
않는다.

## 3. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | `/dashboard/filing-preparation/payment-statements` |
| 화면 | `SimplifiedWageEfilingPanel` — Path 1b 직접작성 값 정리 |
| Read model | `lib/efiling-simplified-wage/summary.ts` |
| 안내 계약 | `lib/efiling-simplified-wage/hometax-guide.ts` |
| 저장/전송 | 없음. 기존 급여·직원 명부 read-only 집계 |
| 외부 링크 | 홈택스 공식 진입점 새 창 열기 |
| 비활성 과거 자산 | 고정길이 레코드 builder와 generate API는 기술 검증 자산으로만 보존; UI 접근 없음 |

## 4. Data Contract

### 4.1 사업자·기간

| 화면 값 | 원천 |
|:---|:---|
| 작성 화면 | 상수 `간이지급명세서(근로소득) 직접작성` |
| 귀속기간 | `PaymentStatementSummary.context.halfRangeLabel` |
| 사업자등록번호 | billing profile masked value |
| 상호·대표자 | billing profile / client |
| 소득자 수 | `simplified.status === 'ready'` 행 수 |
| 지급총액 합계 | 준비 완료 소득자 `grossPayKrw` 합계 |

### 4.2 소득자별 직접작성 값

| 화면 값 | 원천 | 규칙 |
|:---|:---|:---|
| 소득자 | 급여행·직원 명부 매칭 | 준비 완료 행만 표시 |
| 근무기간 | `hireDate`/`terminationDate`를 반기에 clip | `YYYY-MM-DD ~ YYYY-MM-DD` |
| 월별 지급액 | `payroll_employee_line.gross_pay_krw` | 반기 6개월을 월순서로 표시 |
| 지급총액 | `SimplifiedRow.grossPayKrw` | 월별 합계와 반드시 일치 |
| 인정상여 | 현재 read model `recognizedBonusKrw` | 근거 없는 추정 금지 |
| 식별정보 | 앱 데이터 없음 | `홈택스에서 직접 입력`; 앱 저장 금지 |

간이지급명세서에는 원천징수세액을 직접작성 값으로 보여주지 않는다. 상단의 일반 급여
검토 표에는 원천세 검토를 위해 남아 있을 수 있지만, Path 1b 표에는 포함하지 않는다.

## 5. Validation

Path 1b 화면은 파일 형식 검증이 아니라 **입력값 준비 상태**만 검증한다.

1. 사업자등록번호 10자리, 상호, 대표자 존재
2. 반기 급여 자료 누락 월 없음
3. 소득자 상태가 `ready`
4. 월별 지급액 합계와 반기 지급총액 일치
5. 근무시작일이 근무종료일보다 늦지 않음

주민등록번호, 세무서코드, 담당자 연락처, 파일명, 레코드 길이는 Path 1b 검증 대상이
아니다.

## 6. UI Contract

표시 순서:

1. `홈택스 직접작성 값 정리` 제목 + `Path 1b` 표시 + 홈택스 열기
2. 입력값 준비 완료/먼저 확인할 직원 두 카운트
3. 홈택스 입력 경로 3단계
4. 사업자·신고기간 값
5. 소득자별 월 지급액·지급총액·인정상여 표
6. blocker가 있을 때만 `직접작성 전에 확인`
7. 파일 생성·자동입력·자동제출을 하지 않는 책임 경계

금지되는 UI:

- `전자신고 파일 후보`, `파일 생성 준비`, `plain 다운로드`
- 파일 규격 상태, 전자신고 암호, 적합성 검정 대기
- 앱 안의 주민번호·원천징수의무자 식별번호 입력 폼
- 실제 업로드 가능성이 확인되지 않은 파일을 거의 완성된 것처럼 보여주는 단계형 wizard

승인 Preview: [09_payment_year_end.html](../02_UI_Screens/previews/09_payment_year_end.html)

## 7. Implementation Status

| 작업 | 상태 |
|:---|:---|
| 공식 제출방법 재확인 | 완료 — 직접작성 제출 확인 |
| UI-First Preview Path 1b 전환 | 완료 — 2026-07-13 오너 승인 방향 반영 |
| read model 직접작성 값 전환 | 완료 |
| 런타임 파일 생성 UI 제거 | 완료 |
| 홈택스 경로·월별 값 표 구현 | 완료 |
| 타입·단위·전체 회귀 테스트 | PR 검증 단계 |
| 브라우저 확인 | PR 검증 단계 |
| 문서·Backlog·QA 동기화 | PR 검증 단계 |

## 8. Acceptance Criteria

- [x] 확정 급여에서 사업자·기간·소득자별 직접작성 값이 파생된다.
- [x] 반기 6개월 월별 지급액과 지급총액을 함께 확인할 수 있다.
- [x] 월별 합계와 지급총액 불일치는 blocker로 표시한다.
- [x] 파일 생성·PII 입력·plain 다운로드 UI가 없다.
- [x] 홈택스 직접작성 경로와 사용자 직접 입력·제출 책임을 표시한다.
- [x] 원천징수세액을 간이지급 직접작성 값으로 잘못 표시하지 않는다.
- [x] 주민등록번호를 저장하거나 API로 전송하지 않는다.
- [ ] 브라우저에서 desktop/mobile 넘침·문구·데이터를 확인한다.
- [ ] 전체 테스트·lint·whitespace가 통과한다.
- [ ] Backlog·Completion Contract·Roadmap이 main과 일치한다.

## 9. Historical Assets

`build-records.ts`, 파일 검증 테스트, generate API는 과거 고정길이 규격 연구와 회귀
근거로 보존한다. 이는 활성 Path 1b 기능이 아니며 사용자 화면에서 호출하지 않는다.
향후 국세청이 공식 비암호화 직접 업로드 양식과 수용 메뉴를 제공하고 실제 검증이
통과한 경우에만 별도 Path 1a 계약으로 재평가한다.

## 10. Related Documents

- [Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [Historical Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)
- [Historical Field Mapping](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md)
- [PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Completion Contract §3 / JC-030](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Backlog JC-030](../04_Logic_Progress/00_BACKLOG.md)
