# JC-030 — 근로소득 간이지급명세서 전자신고 필드 매핑
> Created: 2026-07-07 00:30 KST
> Last Updated: 2026-07-07 18:30 KST

## 0. Flow Status

```text
[Flow]
현재: JC-030 Slice 1 — HWP 참조본 입수·ABC 레코드 필드 매핑 초안
Gate: 부분 통과 (매핑 초안 완료 · 제출 직전 최신 HWP 대조·세무서코드 등 갭 해소 필요)
완료: 2019·2021 NTS HWP 참조본(scratch) · 근로소득(SC) A/B/C 레코드 폭 190바이트 · JC-024 소스 연결
다음: Slice 2b fcrypt 암호화 — [NTS Crypto Spec](./31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md)
필요 확인: 홈택스 자료실 최신 HWP·정오표(제출 반기 직전)
```

라벨 — **[확실]** HWP 2019·2021 NTS 첨부 파싱 · **[추정]** SemuAgent 소스→필드 연결 · **[갭]** DB에 없는 필드(세무서코드·담당자 등)

## 1. Purpose

JC-030 v1이 생성하는 파일은 **근로소득 간이지급명세서(근로소득)** 전산매체 규격이다.
본 문서는 공식 HWP의 A/B/C 레코드와 SemuAgent 데이터(JC-024·명부·회사 설정)의
**1차 매핑표**이다. 암호화(fcrypt)·홈택스 적합성 검정은 [Pre-Code Brief](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md)·[NTS Crypto Spec](./31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md)를 따른다.

## 2. Reference HWP (Acquired 2026-07-07)

| 항목 | 값 |
|------|-----|
| 로컬 보관 | `scratch/jc-030-reference/` (gitignored, [README](../../scratch/jc-030-reference/README.md)) |
| 구조 기준 | `2019_간이지급명세서4종_전산매체제출요령.hwp` §1 근로소득 |
| 정의 갱신 참고 | `2021상반기_간이지급명세서3종_전산매체제출요령.hwp` — C14/C15 의미 변경 |
| 홈택스 최신본 | **미입수** — 구현·제출 직전 자료실 재다운로드 필수 |

### 2.1 파일·레코드 개요 (근로소득 SC)

| 항목 | 값 | 근거 |
|------|-----|------|
| 파일명 접두 | `SC` + 사업자등록번호 10자리(하이픈 제거) | HWP 예: `SC1234567890` |
| 레코드 종류 | A(제출자) → B(원천징수의무자 집계) → C(소득자)×N | HWP |
| 레코드 길이 | **190 byte** 고정 (A=B=C) | 2019·2021 HWP |
| 자료구분(A2/B2/C2) | `77` (근로소득) | HWP |
| 줄 구분 | HWP 명시(구현 시 최신본 확인) | [미확인 — 인코딩은 Brief §6] |
| 원천징수세액 | **C레코드 미기재** | Layout Acquisition §5 |

### 2.2 2019 → 2021 C레코드 금액 항목 변화

| 항목 | 2019 HWP | 2021 HWP (근로) |
|------|----------|-----------------|
| C14 | 과세소득금액(인정상여 제외) | **총 급여 금액**(인정상여·비과세 제외) |
| C15 | 비과세소득금액 | **인정상여 금액** |
| B12 합계 | Σ C14 과세 | Σ C14 총급여 [추정 동일 패턴] |
| B13 합계 | Σ C15 비과세 | Σ C15 인정상여 [추정 동일 패턴] |

v1 매핑은 **2021 정의(C14=총급여, C15=인정상여)** 를 기준으로 한다. JC-024는 인정상여·비과세를 분리 저장하지 않으므로 C15=0, C14=반기 `grossPayKrw` 합으로 시작한다.

## 3. SemuAgent Data Sources

| 도메인 | 테이블/모듈 | JC-030 용도 |
|--------|-------------|-------------|
| 급여 월별 | `payroll_employee_line` | 월별 `grossPayKrw` · 반기 합계 · 근무월 존재 |
| 급여 기간 | `payroll_period_summary` | 반기 6개월 period 존재·확정 여부 |
| 직원 명부 | `employee_profile` | 성명·입사일·퇴사일·재직상태·`employeeCode` |
| 사업장 | `client` + billing profile | 상호·사업자등록번호·대표자명·사업자 유형 |
| 세션 일회성 | UI 입력(Zod) | 주민등록번호·세무서코드·담당자 연락처 등 [PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md) |
| 집계 read model | `lib/payment-statements/summary.ts` | 반기·직원별 준비 상태·blocker |

**포함하지 않음:** `incomeTaxKrw`(간이지급 파일 미기재), `localIncomeTaxKrw`, 연말정산 정산액.

## 4. A레코드 — 제출자

SemuAgent self-filing: **A5=3(개인)** 또는 **A5=2(법인)**. 세무대리인(A5=1) 경로는 v1 제외.

| 필드 | 타입·길이 | SemuAgent 소스 | 비고 |
|------|-----------|----------------|------|
| A1 | X(1) `A` | 상수 | |
| A2 | 9(2) `77` | 상수 | |
| A3 | X(3) 세무서코드 | **일회성 입력** 또는 회사 설정 [갭] | DB 미보유 |
| A4 | 9(8) 제출연월일 | `Luxon` now `yyyyMMdd` (Asia/Seoul) | 제출 당일 |
| A5 | 9(1) 제출자구분 | `client.taxEntityType` → `corporation`=2, else 3 | 세무대리 1 금지 |
| A6 | X(6) 세무대리인관리번호 | 공백 | A5≠1 |
| A7 | X(20) 홈택스ID | 공백 또는 일회성 [추정] | 전자제출 시 HWP는 기재 요구 — 변환제출 경로에서 필수 여부 Brief에서 확정 |
| A8 | X(4) 세무프로그램코드 | `9000` (기타) | SemuAgent 전용 코드 신청 전 |
| A9 | X(10) 사업자등록번호 | `billing_profile.businessRegistrationNumber` (하이픈 제거) | tenant `client` |
| A10 | X(30) 상호 | `client.name` | |
| A11 | X(30) 담당부서 | 일회성 입력 또는 기본값 `세무` [갭] | |
| A12 | X(30) 담당자성명 | 로그인 사용자 표시명 [갭] | |
| A13 | X(15) 담당자전화 | 일회성 입력 [갭] | |
| A14 | 9(5) 신고의무자수 | `1` (단일 사업장 v1) | 다중 B레코드는 후순위 |
| A15 | X(25) 공란 | Space | |

## 5. B레코드 — 원천징수의무자 집계

v1: **B레코드 1건**(자기 사업장 = 제출자).

| 필드 | 타입·길이 | SemuAgent 소스 | 비고 |
|------|-----------|----------------|------|
| B1 | X(1) `B` | 상수 | |
| B2 | 9(2) `77` | 상수 | |
| B3 | X(3) 세무서코드 | A3와 동일 | 납세지 관할 |
| B4 | 9(6) 일련번호 | `1` | |
| B5 | X(40) 상호 | `client.name` | |
| B6 | X(30) 대표자명 | billing 대표자 [갭] | profile 필드 확인 |
| B7 | X(10) 사업자등록번호 | A9와 동일 | |
| B8 | X(13) 주민/법인번호 | 법인등록번호 또는 개인사업자 대표 주민번호 일회성 입력 | PII · 서버/DB 저장 금지 |
| B9 | 9(4) 귀속연도 | `ReportingContext.year` | JC-024 context |
| B10 | 9(1) 반기 | `1`=상반기, `2`=하반기 | `ReportingContext.half` |
| B11 | 9(10) C레코드 수 | 생성한 C레코드 건수 | 퇴사·재입사 분리 시 1인 다건 |
| B12 | 9(13) 합계 | Σ C14 | 순수 함수 검증 |
| B13 | 9(13) 합계 | Σ C15 | 순수 함수 검증 |
| B14 | X(44) 공란 | Space | |

## 6. C레코드 — 소득자 (근로자)

**1인 1근로기간 = 1 C레코드.** 퇴사 후 재입사 시 HWP는 기간별 별도 C레코드.

| 필드 | 타입·길이 | SemuAgent 소스 | 비고 |
|------|-----------|----------------|------|
| C1 | X(1) `C` | 상수 | |
| C2 | 9(2) `77` | 상수 | |
| C3 | X(3) 세무서코드 | B3 | |
| C4 | 9(7) 일련번호 | B 내 1..N | |
| C5 | X(10) 사업자등록번호 | B7 | |
| C6 | X(13) 주민등록번호 | **일회성 입력**(직원별) | [PII Policy] DB 미저장 |
| C7 | X(30) 성명 | `employee_profile.displayName` / line `employeeName` | |
| C8 | X(20) 전화번호 | 공백 또는 일회성 [갭] | |
| C9 | X(1) 내외국인 | `1` 기본 / 외국인 `9` | 명부에 국적 필드 없음 → v1 기본 내국인 |
| C10 | X(1) 거주 | `1` 거주 | v1 국내 근로 가정 |
| C11 | X(2) 거주지국 | `KR` 또는 공백 | C10=1 |
| C12 | X(8) 근무시작 | `max(hireDate, 반기첫날)` → `yyyyMMdd` | Luxon |
| C13 | X(8) 근무종료 | `min(terminationDate, 반기말)` → `yyyyMMdd` | 퇴사 없으면 반기말 |
| C14 | 9(13) 총급여 | Σ 반기 내 해당 기간 `grossPayKrw` | 2021 정의 |
| C15 | 9(13) 인정상여 | `0` (v1 — 급여 line에 없음) | 추후 payroll 확장 |
| C16 | X(58) 공란 | Space | |

### 6.1 JC-024 반기 집계 → C레코드 변환 규칙

```text
FOR each employee_group IN payment-statements simplified rows (status = ready):
  IF single continuous employment in half:
    ONE C record; C12/C13 from hire/termination clipped to half
    C14 = simplified.grossPayKrw (already semi-annual sum)
  IF hire/termination splits period within half (재입사):
    SPLIT into multiple C records per HWP FAQ; each with own C12-C14
  IF simplified.status != ready:
    EXCLUDE from file; surface in JC-030 validation panel
```

월별 `payroll_employee_line`은 **누락 월 검증**과 재입사 분할에 사용한다. 반기 표시 합계와 Σ(월별 gross) 불일치 시 **검증 오류**.

### 6.2 식별정보 일회성 입력 키

| UI 키 | 매핑 | 검증 |
|-------|------|------|
| `employeePii[employeeKey].residentId` | C6 | Zod 13자리·체크섬 [구현 시] |
| `submission.taxOfficeCode` | A3, B3, C3 | Zod 3자리 |
| `submission.representativeId` | B8 | Zod 13자리 · 법인/개인 모두 필수 |
| `submission.contactPhone` | A13 | 선택 |

요청 종료 시 메모리 폐기. 서버·로그·DB 저장 금지 ([PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)).

## 7. Validation Rules (Mapping-Derived)

| ID | 규칙 | UI 심각도 |
|----|------|-----------|
| V-01 | A/B/C 레코드 길이 190 byte | error |
| V-02 | 첫 레코드 = A, A 레코드 1개 | error |
| V-03 | B 건수 = A14 | error |
| V-04 | B11 = C 건수 | error |
| V-05 | B12 = Σ C14, B13 = Σ C15 | error |
| V-06 | C12 ≤ C13 | error |
| V-07 | JC-024 `needs_review` / `missing_months` 직원 포함 | error (파일 생성 차단) |
| V-08 | C6 미입력 직원 | error |
| V-09 | A3/B3 세무서코드 또는 B8 주민/법인번호 미입력 | error |
| V-10 | 반기 6개월 중 급여 period 누락 | warn → error (정책: Brief §7) |
| V-11 | Σ(월별 gross) ≠ C14 | error |

적합성 검정(홈택스 업로드 후)은 JC-030 v1 **범위 밖** — 사전검증만 제공.

## 8. Known Gaps (Pre-Implementation)

| 갭 | v1 처리 | 후속 |
|----|---------|------|
| 세무서코드 | 제출 폼 일회성 입력 | 회사 설정 필드 |
| 담당자 부서/성명/전화 | 일회성 또는 세션 기본값 | 설정 화면 |
| 법인등록번호/대표 주민번호(B8) | 법인/개인 모두 일회성 필수 입력 | 설정 저장 없이 요청 body에서만 사용 |
| 인정상여(C15) | 0 고정 | payroll 비과세/상여 분리 |
| 월별 금액 필드(2022+ 변경 가능성) | 반기 합계만 C14 | 최신 HWP 대조 |
| fcrypt 암호화 | Brief §4.2 · [NTS Crypto Spec](./31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md) | 구현 슬라이스 2b |
| 홈택스 최신 HWP | 제출 직전 수동 대조 | 운영 체크리스트 |

## 9. Related Documents

- [Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)
- [PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Pre-Code Brief](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md)
- [Payment Statement Brief §4](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)
- [Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
