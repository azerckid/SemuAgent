# JC-030 — 원천징수이행상황신고서 업로드 양식 필드 매핑
> Created: 2026-07-07 04:40 KST
> Last Updated: 2026-07-10 21:22 KST

## 0. Flow Status

```text
[Flow]
판정: 원천세 W0 closed blocked — Field Mapping Part A까지만 보존
Gate: 공식 경로가 직접작성 또는 비밀번호 기반 회계프로그램 변환파일이라 Path 1 부적합
완료: 별지 제21호 A01 매핑 · NTS 공식 신고방법 감사 · 검증 패널
다음: 없음. 최신 공식 비암호화 양식과 직접 수용 메뉴가 새로 확인될 때만 W0 재개
금지: 바이너리 레코드·fcrypt·암호화 파일을 Path 1 대체물로 구현
```

라벨 — **[확실]** law.go.kr 별지 제21호·JC-013 live 값 · **[추정]** SemuAgent→A01 연결 · **[갭]** 홈택스 공식 비암호화 업로드 양식·필드 위치

## 1. Purpose

JC-030 Path 1 **2번 세목 후보**는 **원천징수이행상황신고서**였다.
본 문서는 (A) **신고서 서식 필드**와 SemuAgent 데이터의 1차 매핑, (B) **공식 업로드 양식 위치** 갭을 기록한다.

공식 조사 결과 원천세는 현재 Path 1 계약에서 `closed blocked`로 종료했다. 이 문서는
서식 정합과 기존 Part A 자산을 보존하지만 Part B·generator 착수 계약으로 사용하지 않는다.

관련: [Layout Acquisition](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md) · [Simplified Wage Field Mapping](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md)

## 2. Reference Materials (Acquired 2026-07-07)

| 항목 | 값 |
|------|-----|
| 로컬 보관 | `scratch/jc-030-reference/withholding/` (gitignored) |
| 서식 근거 | 소득세법 시행규칙 **별지 제21호** — law.go.kr `flSeq=139187577`, 개정 **2024.3.22** |
| 작성 절차 | NTS `원천징수이행상황신고서 작성요령` — A01 작성 규칙 참고 |
| 공식 비암호화 업로드 양식 | **미확인** — HWP/PDF 서식은 업로드 수용 근거가 아님 |

## 3. SemuAgent Data Sources

| 도메인 | 테이블/모듈 | JC-030 용도 |
|--------|-------------|-------------|
| 급여 기간 | `payroll_period_summary` | `closeStatus`, `employeeCount`, `grossPayKrw`, `withholdingTaxKrw` |
| 급여 라인 | `payroll_employee_line` | `incomeTaxKrw`, `localIncomeTaxKrw` 합계·`needs_review` 검증 |
| 지방소득세 | `lib/local-income-tax/summary.ts` | JC-027과 동일 `localIncomeTaxKrw` (위택스 별도) |
| 신고지원 | `lib/filing-support/summary.ts` | JC-013 원천세 가이드 값·교차 검증 |
| 사업장 | `client` + billing profile | 상호·사업자등록번호·대표자 |
| 세션 일회성 | UI 입력(Zod) | 세무서코드·담당자 연락처 등 [갭] — 간이지급보다 PII 낮음 |

**v1 포함:** **매월** 신고·**근로소득 간이세액(A01)** 행 집계만.  
**v1 제외:** 중도퇴사(A02)·일용(A03)·환급조정(⑫~㉑)·부표(4~5쪽)·다른 소득구분(A20~A80).

## 4. Part A — 신고서 서식 필드 (별지 제21호 제1쪽)

### 4.1 기본사항

| 서식 항목 | SemuAgent 소스 | 비고 |
|-----------|----------------|------|
| ① 신고구분 **매월** | 상수 `매월` | v1; 반기납 사업자는 후순위 |
| ② 귀속연월 | `ReportingContext.payrollMonth` → `yyyy`·`MM` | 급여 귀속월 |
| ③ 지급연월 | 동월 또는 지급일 기준 [갭] | v1: **귀속연월과 동일** 가정(당월 지급) |
| 사업자등록번호 | billing `businessRegistrationNumber` | 하이픈 제거 |
| 법인명(상호)·대표자 | `client.name` · billing 대표자 [갭] | |
| ⑩ 납부세액 소득세 등 | A01 ⑥ + 가산세 등 — 아래 §4.2 | |

### 4.2 근로소득 — 간이세액 (코드 **A01**)

JC-013 가이드·JC-012 집계와 1:1 대응하는 **핵심 v1 행**.

| 서식 열 | 코드 | SemuAgent 소스 | 비고 |
|---------|------|----------------|------|
| ④ 인원 | A01 | `payroll_period_summary.employeeCount` (확정 라인 기준) | JC-013 `간이세액 대상`과 동일 |
| ⑤ 총지급액 | A01 | `payroll_period_summary.grossPayKrw` | JC-013 `총지급액` |
| ⑥ 소득세 등 | A01 | Σ `payroll_employee_line.incomeTaxKrw` (확정·`ready`/`closed`) | JC-013 `징수세액`; `withholdingTaxKrw` **사용 금지** |
| ⑦ 농어촌특별세 | A01 | `0` [갭] | SemuAgent 미집계; 대부분 0 |
| ⑧ 가산세 | A01 | `0` | v1 |
| ⑨ 당월조정 환급세액 | A01 | `0` | v1 — 환급 엔진 없음 |
| ⑩ 납부 소득세 등 | A01 | ⑥ + ⑧ − ⑨ (서식 규칙) | 검증 함수 |

**JC-013 교차 검증:** `buildFilingPreparationValues` steps 2~3 값과 A01 ④⑤⑥이 **동일**해야 한다.

### 4.3 가감계 (A04) — v1 단순화

매월 신고에서 A02·A03이 없으면:

```text
A04 ④ = A01 ④
A04 ⑤ = A01 ⑤
A04 ⑥ = A01 ⑥
… (⑦⑧⑨⑩ 동일 패턴)
```

### 4.4 지방소득세 (JC-027)

| 항목 | 처리 |
|------|------|
| 원천징수이행상황신고서 ⑩ | **국세(소득세)** 중심; 지방소득세는 서식·위택스 경로 별도 |
| JC-027 `localIncomeTaxKrw` | 위택스 특별징수 신고(JC-027) — **본 파일 v1 범위 밖** |
| JC-013 가이드 | `지방소득세` 값 표시는 유지(수동 위택스) |

### 4.5 PII 범위 (v1)

| 항목 | 판정 |
|------|------|
| 직원별 주민번호 | **v1 불필요** — A01은 **집계 행**만 |
| 부표(개인별) | v1 **제외** (이자·배당·법인원천 등 해당 시에만) |
| 일회성 입력 | 세무서코드·담당자 등 [갭] — 공식 업로드 양식 확인 후 Brief(39) |

## 5. Part B — 공식 비암호화 업로드 양식 위치 (미확인)

W0 공개 조사에서 원천세 작성 서식은 확인했지만 홈택스가 직접 수용하는
비암호화 업로드 원본은 확인하지 못했다. 확정 전 아래는 **[갭]**이다.

| 항목 | 상태 | 선행 조사 |
|------|------|-----------|
| 공식 파일명·확장자 | [갭] | XLSX·CSV·HWP 등 실제 수용 형식 확인 필요 |
| 시트·표·열 구조 | [갭] | 공식 원본 파일 필요 |
| 필수 필드·코드 | [갭] | A01과 사업장·기간 위치 확인 필요 |
| 적용일·버전 | [갭] | 제출 시점 최신본 필요 |
| 홈택스 업로드 메뉴 | [갭] | 로그인 후 `원천세 신고 > 일반신고` 내부 확인 필요 |
| 비암호화 직접 수용 | [갭] | 암호·fcrypt 없이 업로드되는지 실제 검증 필요 |

**확인 순서:**

1. 홈택스 로그인 → `세금신고 > 원천세 신고 > 일반신고`의 양식 다운로드·파일 업로드 기능 확인
2. 국세청 **126**에 공식 비암호화 업로드 양식 존재·다운로드 위치 문의
3. 양식이 없고 암호화 전자파일만 가능하면 원천세 Path 1을 blocked로 유지

## 6. Validation Rules (v1 초안 — 서식 정합)

| ID | 규칙 | 심각도 |
|----|------|--------|
| W-01 | `payroll_period_summary.closeStatus === 'closed'` | blocking |
| W-02 | Σ `incomeTaxKrw` = A01 ⑥ (JC-013 `징수세액`과 일치) | blocking |
| W-03 | `employeeCount` > 0 이면 `grossPayKrw` > 0 | warning |
| W-04 | `needs_review` 라인 존재 시 export 차단 | blocking |
| W-05 | 공식 비암호화 업로드 양식·수용 경로 미확인 시 **파일 다운로드 차단**, 서식 검증만 표시 | blocking |

## 7. Implementation Gate

| 단계 | 조건 |
|------|------|
| W0 Layout | 공식 비암호화 업로드 원본과 홈택스 직접 수용 경로 확인 |
| W1 Pre-Code Brief(39) | Part B 시트/셀/열 매핑 + 최종 사용자 승인 |
| W2 generator | W0·W1 완료 후; 공식 양식 형식에 맞춰 구현 |
| UI 패널 | UI-First와 Slice 1a 검증 패널 완료; W2에서 동일 read model로 파일값 연결 |

## 8. Related Documents

- [Withholding Layout Acquisition](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
- [Withholding Pre-Code Brief](./39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md)
- [Filing Support Pre-Code Brief](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md)
- [JC-030 E-Filing File PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
