# JC-030 VAT Stage A — Official Non-Encrypted Upload Template Audit
> Created: 2026-07-10 21:22 KST
> Last Updated: 2026-07-10 21:22 KST

## 0. Flow Status

```text
[Flow]
현재: 부가세 Path 1 Stage A — 공식 비암호화 업로드 양식·홈택스 직접 수용 경로 감사
판정: partial / blocked
확인: 홈택스 공식 매뉴얼에 일부 부속명세의 회계프로그램 파일변환 흐름 존재
미확인: 전체 부가세 신고용 공식 비암호화 원본 양식·규격·직접 수용 메뉴
다음: 로그인 화면 또는 국세청 126으로 정확한 파일·버전·비암호화 수용 여부 확인
금지: Stage A 통과 전 필드 매핑·Preview·Brief·generator 구현
```

## 1. Purpose

부가세 Path 1은 자료대조원장 Phase 2와 VAT provenance에서 확정한 값으로
홈택스가 직접 수용하는 **공식 비암호화 업로드 양식**을 작성하는 경로다.

이 문서는 다음을 구분한다.

1. 홈택스에 부가세 신고서 작성 화면이 존재하는가.
2. 일부 부속명세에 회계프로그램 파일변환 기능이 존재하는가.
3. SemuAgent가 작성할 수 있는 공식 비암호화 원본 양식·규격과 직접 수용 메뉴가 존재하는가.

1번이나 2번만 확인되어도 3번이 확인되지 않으면 Stage A는 통과하지 않는다.

## 2. Product Gate

Stage A 통과에는 아래 근거가 모두 필요하다.

| 근거 | 통과 조건 |
|:---|:---|
| 공식 원본 | 국세청·홈택스가 배포한 파일 또는 공식 기계 판독 규격 |
| 적용성 | 세목, 신고유형, 기간, 버전·적용일 확인 |
| 구조 | 시트·열·레코드·필수 필드가 공식 자료로 확인됨 |
| 직접 수용 | 홈택스의 정확한 메뉴와 업로드 단계 확인 |
| 비암호화 | 암호·fcrypt·인증·적합성 검정 없이 수용됨 |
| 운영 검증 | 공식 샘플 또는 최소 fixture가 업로드 검증 단계에서 수용됨 |

## 3. Official Evidence

### 3.1 홈택스 공개 부가가치세 전자신고 매뉴얼

공식 매뉴얼:
https://teht.hometax.go.kr/doc/rn/a/a/%EB%B6%80%EA%B0%80%EA%B0%80%EC%B9%98%EC%84%B8%20%EC%A0%84%EC%9E%90%EC%8B%A0%EA%B3%A0%20%EB%A7%A4%EB%89%B4%EC%96%BC_181001.pdf

공개된 매뉴얼에서 확인한 사실:

- 매출처별세금계산서합계표는 직접 작성 또는 파일변환 흐름을 제공한다.
- 부동산임대공급가액명세서, 현금매출명세서, 신용카드매출전표등 수령명세서,
  계산서합계표 등 일부 부속명세에 회계프로그램 파일변환과 파일명 규칙이 있다.
- 파일변환 후 내용 수정은 작성 화면이 아니라 회계프로그램에서 파일을 다시 만들어야 한다.
- 자료실에서 제공하는 일반 Excel 프로그램은 해당 변환 흐름에 사용할 수 없다고 안내한다.

### 3.2 확인된 파일명 예시

| 부속명세 | 매뉴얼의 파일명 예시 |
|:---|:---|
| 부동산임대공급가액명세서 | `E + 사업자등록번호` |
| 현금매출명세서 | `S + 사업자등록번호` |
| 신용카드매출전표등 수령명세서 | `J + 사업자등록번호` |
| 계산서합계표 | `H + 사업자등록번호` |

이 매뉴얼은 공개 공식 절차의 근거지만 2026년 로그인 화면의 최신 사양을 단독으로
확정하는 자료는 아니다. 위 예시는 일부 부속명세 파일변환의 존재 근거다. 전체 부가세 신고서용 공식
비암호화 업로드 템플릿이나 SemuAgent 구현 규격의 근거로 확대 해석하지 않는다.

## 4. Evidence Boundary

### 4.1 입증된 것

- 홈택스 부가세 전자신고에 일부 부속명세 파일변환 흐름이 있다.
- 회계프로그램 파일을 기준으로 하는 부속명세별 파일명 규칙이 있다.
- 현재 SemuAgent의 Phase 2 gate와 VAT provenance는 향후 공식 파일 생성의
  확정 데이터 소스로 재사용할 수 있다.

### 4.2 아직 입증되지 않은 것

- 전체 부가세 신고서를 한 번에 업로드하는 공식 비암호화 양식.
- 공개 다운로드 가능한 최신 원본 파일과 필드 레이아웃.
- 위 부속명세 파일이 암호·fcrypt·별도 인증 없이 현재 홈택스에 수용되는지.
- 신고유형별 필수 부속명세 조합과 최신 적용 버전.
- SemuAgent가 생성한 대표 fixture의 실제 홈택스 수용.

## 5. Stage A Verdict

**판정: `partial / blocked`.**

일부 부속명세 파일변환 근거는 확인했지만, Path 1 구현을 시작할 만큼 공식 원본·규격·
비암호화 직접 수용 경로가 완결되지 않았다. 따라서 현재 단계에서는 다음을 하지 않는다.

- 부가세 generator 코드 작성
- 기존 VAT snapshot을 임의 파일 레코드에 배치
- 공개 매뉴얼 화면을 보고 바이너리·텍스트 포맷 추정
- 직접입력 가이드로 대체
- 암호화 변환파일 경로로 우회

## 6. Next External Verification

홈택스 로그인 화면 또는 국세상담센터 126에서 아래 질문을 확인한다.

1. 현재 일반과세자 부가세 신고 전체를 업로드할 수 있는 공식 비암호화 양식이 있는가.
2. 매뉴얼의 부속명세 파일변환은 현재도 지원되며 암호·fcrypt 없이 수용되는가.
3. 지원된다면 최신 원본 파일·레이아웃·정오표의 공식 다운로드 위치는 어디인가.
4. 정확한 홈택스 메뉴, 허용 확장자, 파일명, 크기, 버전·적용일은 무엇인가.
5. 공식 샘플 또는 테스트 파일을 제출 전 검증할 수 있는 경로가 있는가.

확인 결과는 URL·확인일·메뉴·파일 사본·적용일과 함께 본 문서에 기록한다.

## 7. Stage A Exit Rules

| 결과 | 다음 작업 |
|:---|:---|
| 공식 비암호화 전체 신고 양식 확인 | Stage B Field Mapping 착수 |
| 공식 비암호화 부속명세만 확인 | v1 파일 범위를 해당 부속명세로 제한할지 별도 제품 결정 후 Stage B |
| 암호화·인증·회계프로그램 전용만 확인 | 부가세를 `closed blocked`로 닫고 지방소득세 Stage A로 이동 |
| 공식 답변이 불명확 | `blocked` 유지, generator 미착수 |

Stage B로 넘어갈 때는 파일 범위와 사용자가 홈택스에서 수행할 정확한 업로드 단계를
먼저 승인받는다. 일부 부속명세만 가능한 경우 이를 `부가세 전체 신고 파일`로 표시하지 않는다.

## 8. Existing SemuAgent Assets To Reuse If Stage A Passes

| 자산 | 재사용 목적 |
|:---|:---|
| `loadReconciliationPath1Gate` | 자료대조 완료 여부 |
| `lib/vat/facts.ts` | 확정 VAT fact |
| `lib/vat/provenance.ts` | 확정 원장 rebuild·fingerprint |
| VAT package gate | 자료수집·공제검토·provenance blocker |
| `/dashboard/vat` | 양식 채움 확인 UI의 선행 화면 |

Stage A 통과 전에는 이 자산들이 준비되어 있다는 이유만으로 파일 형식을 추정하지 않는다.

## 9. Related Documents

- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [E-Filing File Generation Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [Withholding W0 Final Audit](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
- [Path 1 E2E Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)
- [VAT Confirmed-Ledger Provenance Audit](./42_VAT_CONFIRMED_LEDGER_PROVENANCE_AUDIT.md)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- [Logic_Progress / JC-030](../04_Logic_Progress/00_BACKLOG.md)
