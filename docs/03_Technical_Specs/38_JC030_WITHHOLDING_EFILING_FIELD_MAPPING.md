# JC-030 — 원천징수이행상황신고서 전자신고 필드 매핑
> Created: 2026-07-07 04:40 KST
> Last Updated: 2026-07-07 04:40 KST

## 0. Flow Status

```text
[Flow]
현재: JC-030 원천세 — Slice 0b 완료 · Field Mapping 초안(서식 필드) · 바이너리 레이아웃 갭
Gate: 부분 통과 (JC-012/013 ↔ 별지 제21호 A01 매핑 초안 · build-records 전 바이너리 스펙 미입수)
완료: law.go.kr 별지 제21호(2024.3.22) · NTS 작성요령(2009) 홈택스 변환 절차
다음: 전자신고 이용안내/변환프로그램 번들에서 바이너리 레코드 입수 → Pre-Code Brief(39) 승인
필요 확인: 홈택스 자료실·변환프로그램 동봉 문서(제출 직전 최신본)
```

라벨 — **[확실]** law.go.kr 별지 제21호·JC-013 live 값 · **[추정]** SemuAgent→A01 연결 · **[갭]** 전산매체 record type·파일명·인코딩

## 1. Purpose

JC-030 Path 1 **2번 세목**은 **원천징수이행상황신고서** 변환제출용 파일이다.
본 문서는 (A) **신고서 서식 필드**와 SemuAgent 데이터의 1차 매핑, (B) **바이너리 파일 레이아웃** 갭을 기록한다.

간이지급(SC/190byte)과 달리, 원천세는 **별도 `…전산매체 제출요령` HWP가 홈택스 자료실에 공개되어 있지 않다**(Slice 0b 조사). v1 구현은 **서식 정합(집계)** 과 **바이너리 스펙 입수**를 분리해 게이트한다.

관련: [Layout Acquisition](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md) · [Simplified Wage Field Mapping](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md)

## 2. Reference Materials (Acquired 2026-07-07)

| 항목 | 값 |
|------|-----|
| 로컬 보관 | `scratch/jc-030-reference/withholding/` (gitignored) |
| 서식 근거 | 소득세법 시행규칙 **별지 제21호** — law.go.kr `flSeq=139187577`, 개정 **2024.3.22** |
| 작성 절차 | NTS `원천징수이행상황신고서 작성요령` (2009, `nttSn=74837`) — 홈택스 직접작성·**변환프로그램** 절차 |
| 바이너리 레이아웃 | **미입수** — `전자신고 이용안내` 또는 홈택스 **원천세 변환프로그램** 동봉 문서 필요 |

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

**JC-013 교차 검증:** `buildFilingInputGuide` steps 2~3 값과 A01 ④⑤⑥이 **동일**해야 한다.

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
| 일회성 입력 | 세무서코드·담당자·홈택스 ID [갭] — 바이너리 스펙 확정 후 Brief(39) |

## 5. Part B — 바이너리 전자신고 파일 (미입수)

Slice 0b에서 **지급명세서형 `…전산매체 제출요령` HWP는 발견되지 않음**. 확정 전 아래는 **[갭]**.

| 항목 | 상태 | 선행 조사 |
|------|------|-----------|
| 파일명 접두 | [갭] | 간이지급 `SC`와 다를 가능성 |
| 레코드 종류·순서 | [갭] | A/B/C 패턴 여부 미확인 |
| 레코드 길이·인코딩 | [갭] | 전자신고 이용안내 필요 |
| 자료구분 코드 | [갭] | |
| fcrypt 암호화 | [추정] | JC-030 Path 3·간이지급과 동일 계열 |
| plain Path 1 산출물 | [갭] | 변환프로그램이 수용하는 **변환 전** 파일 포맷 확인 필요 |

**입수 후보 (우선순):**

1. 홈택스 **프로그램 설치 → 세금신고 → 원천세** 변환프로그램 설치 번들
2. 국세청 **전자신고 이용안내** 원천세 장
3. 국세청 **126** / 원천세과 **044-204-3348, 3349**

## 6. Validation Rules (v1 초안 — 서식 정합)

| ID | 규칙 | 심각도 |
|----|------|--------|
| W-01 | `payroll_period_summary.closeStatus === 'closed'` | blocking |
| W-02 | Σ `incomeTaxKrw` = A01 ⑥ (JC-013 `징수세액`과 일치) | blocking |
| W-03 | `employeeCount` > 0 이면 `grossPayKrw` > 0 | warning |
| W-04 | `needs_review` 라인 존재 시 export 차단 | blocking |
| W-05 | 바이너리 스펙 미입수 시 **파일 다운로드 차단**, 서식 검증만 표시 | blocking (임시) |

## 7. Implementation Gate

| 단계 | 조건 |
|------|------|
| Pre-Code Brief(39) | 본 문서 Part A 승인 + Part B 입수 계획 승인 |
| `build-records` | Part B 바이너리 스펙 확정 후 |
| UI 패널 | Brief(39) + UI-First (`/dashboard/filing-support` 원천세 항목 연동) |

## 8. Related Documents

- [Withholding Layout Acquisition](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
- [Withholding Pre-Code Brief](./39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md)
- [Filing Support Pre-Code Brief](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md)
- [JC-030 E-Filing File PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
