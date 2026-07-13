# JC-030 Local Income Tax Special Withholding Stage A — Official Excel Upload Template Acquisition
> Created: 2026-07-14 KST
> Last Updated: 2026-07-14 KST

## 0. Flow Status

```text
[Flow]
판정: 지방소득세 특별징수는 Path 1b가 아니라 **Path 1a 후보**
확인: 위택스 공식 현재 매뉴얼에 `엑셀파일신고`와 공식 서식 `B070101-02.xlsx`가 명시됨
분리: 비밀번호가 개입될 수 있는 `회계파일신고`는 현재 제품 범위 밖
현재: Stage A-1 공개 근거 감사 완료 · Stage A-2 공식 Excel 원본 입수 대기
다음: 원본 다운로드 → hash·시트·열·검증규칙 고정 → Stage B Field Mapping
금지: 원본 없이 화면 캡처로 열을 추정하거나, 회계파일 포맷으로 우회하거나, 1b 화면을 먼저 구현
```

## 1. Purpose

지방소득세 특별징수는 급여에 저장된 실제 `localIncomeTaxKrw`를 위택스 신고에
사용하는 세목이다. 기존 JC-027 화면은 확정값 검토까지만 제공하고 위택스 신고는
범위 밖으로 두었다.

JC-030은 다음 두 경로를 구분한다.

1. **Path 1a** — 위택스가 직접 배포하고 업로드받는 공식 비암호화 Excel 양식에
   SemuAgent 확정값을 채워 사용자가 직접 업로드한다.
2. **Path 1b** — 공식 업로드 양식이 없을 때만 위택스 화면의 `항목 = 값`을 정리한다.

이 문서는 2026-07-14 현재 위택스 공식 공개 자료를 다시 확인해 어느 경로가 맞는지
판정하고, Stage B를 시작하기 위한 남은 원본 입수 조건을 고정한다.

## 2. Product Gate

Stage A 통과에는 아래 근거가 필요하다.

| 근거 | 통과 조건 | 현재 상태 |
|:---|:---|:---:|
| 공식 배포 주체 | 위택스가 신고 화면에서 원본 양식을 직접 제공 | 확인 |
| 파일명·형식 | 공식 파일명과 확장자 확인 | 확인 — `B070101-02.xlsx` |
| 직접 수용 메뉴 | 동일 양식을 선택·검증·제출하는 메뉴 확인 | 확인 |
| 비암호화 경로 | Excel 신고 경로에서 별도 암호·fcrypt 요구 없음 | 공개 매뉴얼상 확인 |
| 원본 구조 | 실제 다운로드 파일의 시트·열·셀 제약·버전 확인 | **미확인** |
| 운영 수용 | 대표 fixture가 위택스 검증 단계에서 통과 | **미검증** |

공식 경로가 확인됐다는 이유만으로 원본 구조까지 추정하지 않는다. Stage B Field
Mapping은 실제 Excel 원본을 내려받아 hash와 구조를 고정한 뒤 시작한다.

## 3. Official Evidence

### 3.1 Current WETAX Menu and Guide Entry

2026-07-14 확인한 위택스 공식 경로:

- 위택스 메인: https://www.wetax.go.kr/
- 특별징수 로그인 진입점:
  https://www.wetax.go.kr/etr/lit/b0701/B070101M00.do
- 위택스 공식 빠른 메뉴 API:
  https://www.wetax.go.kr/tcp/api/wtxMain/getListSmpiMenu
- 공식 이용자가이드 진입점:
  https://www.wetax.go.kr/static/guide2/reg/locaincome.html
- 현재 연결된 공식 사용자매뉴얼(2024-02-13):
  https://cdn.wetax.go.kr/static/guide/02%20%EC%8B%A0%EA%B3%A0/10_%EC%82%AC%EC%9A%A9%EC%9E%90%EB%A7%A4%EB%89%B4%EC%96%BC_%EC%8B%A0%EA%B3%A0_%EC%A7%80%EB%B0%A9%EC%86%8C%EB%93%9D%EC%84%B8%20%ED%8A%B9%EB%B3%84%EC%A7%95%EC%88%98%EC%8B%A0%EA%B3%A0.pdf

빠른 메뉴 API는 `pgmId=B070101`, `pgmNm=특별징수`,
`pgmUrl=/etr/lit/b0701/B070101M00.do`를 반환한다. 신고 화면은 로그인 후 열린다.
공식 이용자가이드가 현재 위 PDF를 직접 iframe으로 제공하므로, 과거 제3자 블로그가
아니라 현재 위택스가 연결한 공식 사용자매뉴얼을 Stage A 근거로 사용한다.

### 3.2 One-Filing Route

공식 매뉴얼 §1.1~1.6은 다음 경로를 명시한다.

```text
신고 → 지방소득세 → 특별징수 → 특별징수신고 → 한건신고
```

한건신고의 핵심 입력은 다음과 같다.

- 신고인·특별징수의무자
- 납부시기, 귀속연월, 지급연월
- 소득 구분별 인원, 과세표준금액, 특별징수세액
- 필요한 경우 가감조정액
- 선택 사항인 납세의무자별 특별징수명세서
- 미리보기, 제출, 납부

매뉴얼은 홈택스 원천세 신고정보를 조회해 과세정보와 신고세액을 자동 채우는 기능도
설명한다. SemuAgent의 Path 1a는 이 화면을 자동 조작하지 않으며, 공식 Excel 파일
업로드 경로만 사용한다.

### 3.3 Official Excel File Filing

공식 매뉴얼 §1.9~1.12는 다음 경로를 별도로 명시한다.

```text
신고 → 지방소득세 → 특별징수 → 특별징수신고 → 엑셀파일신고
```

확인된 절차:

1. 위택스 화면에서 **엑셀파일 다운로드**를 선택한다.
2. 공식 파일 `B070101-02.xlsx`를 작성한다.
3. 작성한 Excel 파일을 선택한다.
4. 위택스가 입력 항목을 검증한다.
5. 오류가 없을 때만 제출한다.
6. 제출결과에서 신고 건수와 전자납부번호를 확인한다.

매뉴얼은 이 경로를 “특별징수의무자가 화면에서 등록하지 않고 여러 건을 엑셀파일에
작성하여 일괄로 신고”하는 방식으로 설명한다. 따라서 법정 HWP/PDF 서식의 존재만으로
1a를 추정한 것이 아니라, 위택스가 직접 내려주고 다시 업로드받는 공식 `.xlsx` 경로가
확인됐다.

### 3.4 Accounting-File Route Is Separate and Excluded

공식 매뉴얼 §1.13~1.15의 `회계파일신고`는 민간 회계프로그램이 별도 정의에 따라 만든
파일을 변환·제출하는 경로다. 매뉴얼은 파일이 암호화된 경우 비밀번호를 함께 입력하고
복호화한다고 명시한다.

이 경로는 다음 이유로 현재 제품 범위 밖이다.

- 위택스 공식 Excel 원본이 아니라 민간 회계프로그램 파일이다.
- 암호·비밀번호가 개입될 수 있다.
- Path 3 fcrypt·암호화·회계프로그램 적합성 범위를 다시 열게 된다.

SemuAgent는 `회계파일신고`를 사용하지 않고 `엑셀파일신고`만 Path 1a 후보로 다룬다.

### 3.5 Statutory Form Boundary

국가법령정보센터의 「지방세법 시행규칙」 별지 제42호서식은 지방소득세 특별징수
납부서의 법정 항목을 제공한다.

- 현재 서식:
  https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110202&flSeq=160302709&gubun=
- 주요 항목: 특별징수의무자, 귀속연월·지급연월, 신고 지방자치단체, 소득 구분별
  인원·과세표준·지방소득세, 가감세액·가산세·합계

법정 서식은 필드 의미의 교차검증 근거다. 실제 Excel의 열 순서·시트명·셀 형식은
반드시 위택스가 내려주는 `B070101-02.xlsx` 원본에서 확정한다.

## 4. Stage A Verdict

**판정: 지방소득세 특별징수는 공식 비암호화 Excel 업로드 양식이 존재하므로 Path 1a
후보다. Path 1b 직접입력 화면을 먼저 만들지 않는다.**

다만 Stage A 종료와 Stage B 착수에는 공식 Excel 원본이 필요하다. 현재 공개
매뉴얼에서 파일명·업로드 절차는 확인했지만, 파일 다운로드는 로그인한 신고 화면에서
제공된다. 원본을 확보하기 전까지 다음은 하지 않는다.

- 스크린샷을 보고 Excel 열·셀·유효성 규칙 추정
- 기존 급여 표를 임의 workbook에 배치
- `회계파일신고` 포맷이나 비밀번호 경로 사용
- Path 1b runtime 또는 1a generator 구현
- `Path 1a 지원 완료` 표시

## 5. Official Template Acquisition Checklist

로그인한 위택스에서 아래 절차로 원본을 확보한다.

1. `신고 → 지방소득세 → 특별징수 → 특별징수신고 → 엑셀파일신고` 진입
2. `엑셀파일 다운로드` 선택
3. 내려받은 파일명이 `B070101-02.xlsx`인지 확인
4. 원본을 수정하지 않은 채 SHA-256 기록
5. 입수일, 다운로드 메뉴, workbook 시트명, 열 제목, 예제 행, 데이터 유효성,
   숨김 시트·수식·보호 여부 기록
6. PII가 없는 공식 원본을 `scratch/jc-030-reference/local-income-tax/`에 보관
7. 원본의 재배포 가능성을 확인하기 전 Git 추적 파일로 추가하지 않음

원본 입수 기록에는 위택스 계정·인증서·쿠키·개인정보를 남기지 않는다.

## 6. Stage B Entry Contract

원본 입수 후 별도 Field Mapping 문서에서 다음을 고정한다.

| 대상 | SemuAgent 후보 source | 현재 판정 |
|:---|:---|:---|
| 특별징수의무자 | client/business entity profile | 실제 원본 열 확인 필요 |
| 귀속연월·지급연월 | payroll period·`paymentDate` | 실제 원본 열 확인 필요 |
| 근로소득 인원 | 확정 급여 라인 수 | 후보, 원본 의미 검증 필요 |
| 근로소득 과세표준 | 전용 canonical field 미확인 | `grossPayKrw`·`incomeTaxKrw`로 추정 금지, 원본 의미와 정본 확인 필요 |
| 근로소득 지방소득세 | `localIncomeTaxKrw` 실제 합계 | canonical source |
| 사업·기타·퇴직소득 | 현재 JC-027 급여 read model 범위 밖 | v1 제외 또는 신규 정본 필요 |
| 가감세액·가산세 | 전용 canonical field 없음 | 0 추정 금지, blocker |
| 신고 지방자치단체 | 사업장 납세지 | 전용 확정 필드·코드 매핑 확인 필요 |

`localIncomeTaxKrw`를 `incomeTaxKrw × 10%`로 재계산하지 않는다. Excel에 필요한 값이
현재 정본에 없으면 기본값을 만들지 않고 생성 blocker로 남긴다.

## 7. Completion Line

### 7.1 Stage A-1 Public Evidence Audit Complete

- [x] 현재 위택스 공식 메뉴와 이용자가이드 URL을 기록했다.
- [x] 한건신고·엑셀파일신고·회계파일신고를 구분했다.
- [x] 공식 Excel 파일명과 업로드·검증·제출 절차를 확인했다.
- [x] 회계파일·비밀번호 경로를 현재 범위에서 제외했다.

### 7.2 Stage A-2 Official Original Acquisition Pending

- [ ] 로그인한 위택스에서 원본 `B070101-02.xlsx`를 입수했다.
- [ ] 원본 hash·시트·열·유효성·버전 기록을 고정했다.

### 7.3 Path 1a Done

Stage A 문서 완료가 세목 완료는 아니다. [Path 1 Roadmap §2.1](./36_PATH1_FORM_FILL_ROADMAP.md)의
Field Mapping, UI-First Gate, Pre-Code, generator, 파일 검증, 실제 위택스 수용 검증,
문서 closeout까지 모두 통과해야 Path 1a 완료로 센다.

## 8. Related Documents

- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Local Income Tax Pre-Code Brief](./18_LOCAL_INCOME_TAX_PRE_CODE_BRIEF.md)
- [E-Filing File Generation Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Path 1 E2E Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)
- [Local Income Tax Preview](../02_UI_Screens/previews/10_local_income_tax.html)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- [Logic Progress / JC-030](../04_Logic_Progress/00_BACKLOG.md)
