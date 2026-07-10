# E-Filing File Generation Scope Gate
> Created: 2026-07-05 11:18
> Last Updated: 2026-07-10 16:01 KST

## 0. Flow Status

```text
[Flow]
현재: Path 1 세목 확대 최우선 — 홈택스 양식 입수·기입·신고 보조
완료: 근로소득 간이지급 — Validation + 비암호화 파일 후보·검증·홈택스 안내
현재: 원천세 W0 — [공식 비암호화 업로드 양식·홈택스 수용 경로 확인](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
보류: JC-034 Path 2 ZIP 구현
제외: Path 3 fcrypt·암호화 파일·적합성 검정
```

## 1. Purpose

JC-030은 [Product Baseline §Filing Path Priority](../01_Concept_Design/01_PRODUCT_BASELINE.md)의
**공통 검증**과 **Path 1 비암호화 업로드 파일 생성**을 담당한다.

| 구성 | Filing Path | 설명 |
|---|---|---|
| **Validation** | Path 1 & 2 공통 | 레이아웃·정합성 검증 후 다운로드/ZIP |
| **Path 1** | 공식 비암호화 양식 파일 + 홈택스 안내 | 사이트가 직접 수용하는 공식 업로드 양식 (**현재**) |
| **Path 3** | 인증·암호화 파일 | **현재 제품 범위 밖** |

Path 2 (GIWA handoff ZIP)는 **JC-034**가 담당하며, JC-030 Validation 출력을 소비한다.

## 2. Official Source Check (2026-07-05)

확인한 공식 출처:

- 국세청 `국세청 프로그램` 페이지는 2020년 3월 이후 제작된 국세청 프로그램 자료가
  홈택스 자료실에서 제공된다고 안내한다.
  - URL: https://www.nts.go.kr/nts/na/ntt/selectNttList.do?bbsId=1099&mi=2544
- 같은 국세청 프로그램 게시판에는 과거 `근로소득간이지급명세서 전산매체 제출요령`,
  `지급명세서 전산매체 제출요령`, 부가가치세 첨부서류 전산매체 작성 프로그램 등의
  항목이 남아 있다. 이는 전산매체/파일 제출요령 체계가 존재함을 뒷받침하지만,
  최신본은 홈택스 자료실 확인이 필요하다.
- 국세청 `간이지급명세서(근로소득)` 안내는 제출의무자, 제출기한, 제출주기를 안내한다.
  2026년 현재는 반기 제출이고, 2027년 지급분부터 매월 제출로 전환된다고 안내한다.
  - URL: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239032&mi=40678
- 국세청 `소득자료 제출방법 등` 안내는 홈택스 로그인 후 지급명세·자료 메뉴에서
  일용·간이지급명세서 제출 흐름을 안내한다.
  - URL: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239045&mi=40990

판정 (2026-07-06 Slice 0a 갱신):

- **파일 생성/전산매체 제출 체계 존재**: 확인됨.
- **근로소득 간이지급명세서 제출 의무·주기**: 공식 안내로 확인됨.
- **간이지급 vs 연말 지급명세서 레이아웃 분리**: 확인됨. bulletin 1175(2025 연말 지급명세서)는
  JC-030 v1 대상이 **아님**. v1은 `간이지급명세서(근로소득) 전산매체 제출요령` ([Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)).
- **공식 입수 경로**: 홈택스 자료실 1순위, 국세청 프로그램 게시판·공지 보조 — **경로 확정**.
- **필드 레벨 레이아웃**: git 미보관. Pre-Code Brief 착수 시 최신 HWP+정오표 다운로드 필수.
- **파일변환신고 적합성 검정 요건**: 과거 연구로만 보존; 암호화 파일과 함께 현재 제품 범위 밖.

## 3. Candidate Targets

| 후보 | 장점 | 차단/리스크 | 판정 |
|---|---|---|---|
| 근로소득 간이지급명세서 | JC-024 데이터가 이미 live, 공식 제출주기 확인, 소규모 회사 빈도 높음 | 최신 파일 레이아웃 필요, 직원 식별정보 처리 정책 필요 | **Path 1 완료** |
| 원천세 신고서 | 급여/원천 데이터 live, 지방소득세 정합성까지 완료, 월 신고 | 공식 비암호화 업로드 양식·수용 메뉴 미확인 | **현재 W0, blocked** |
| 부가가치세 | SemuAgent의 핵심 세목, 직원 PII 의존 낮음 | 상세 전자신고 파일 레이아웃 일반 입수 경로 미확인 | 원천세 다음 |
| 법인세/종합소득세 | 커버리지 확장 가치 큼 | JC-025/026 미구현, 법무/세무조정 리스크 큼 | 후순위 |

## 4. v1 Direction

JC-030 **1차 완료 세목:** 근로소득 **간이지급명세서** (Path 1 구현됨).

**다음 확대:** 원천세 신고서 → 부가가치세. 순서·게이트는 [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md).

### Validation (Path 1 & 2 공통)

1. JC-024 live data → layout validation via `lib/efiling-simplified-wage`.
2. Output feeds Path 1 non-encrypted download. Path 2 JC-034 ZIP는 Path 1 세목 확대 안정 후 재사용.

### Path 1 — 양식 파일 + 홈택스 안내 (현재)

1. 공식 비암호화 업로드 양식 generation + pre-validation UI.
2. Hometax direct file-upload guide (JC-013 alignment).
3. 공식 비암호화 양식과 직접 수용 경로가 확인되지 않은 세목은 생성하지 않는다.

### Path 3 — 인증·암호화 파일 (제외)

fcrypt, 전자신고 암호, 인증·적합성 검정, 암호화 파일 생성은 현재 제품 범위가
아니다. Path 1 세목이 비암호화 업로드를 지원하지 않으면 암호화 경로로 우회하지
않고 해당 세목을 blocked로 기록한다.

## 5. Blocking Decisions Before Implementation

### 5.1 최신 파일 레이아웃 확보

**결정(2026-07-06, JC-030 Slice 0a):** [Layout Acquisition Brief](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)

- v1 대상 문서: **`간이지급명세서(근로소득) 전산매체 제출요령`** (+ 정오표). 연말 `지급명세서
  전산매체 제출요령`(홈택스 자료실 1175 등)과 **혼동 금지**.
- 입수: 홈택스 자료실 검색 1순위; 국세청 프로그램 게시판(`bbsId=1099`)·공지 보조.
- 구현 직전: 제출 대상 반기의 **최신 HWP·정오표** 재다운로드.
- Pre-Code Brief에서 공식 업로드 파일의 확장자, 시트·표·열 구조, 필수 필드와 적용일을 확정.

**필드 매핑·생성기 구현 전에는 "홈택스 업로드 가능"으로 표시하지 않는다.**

### 5.2 직원 식별정보 정책

JC-024에서 주민등록번호는 저장·검증 범위 밖으로 명시했다. 이는 최소 PII 원칙상 올바른
결정이었지만, 근로소득 지급명세서 파일 생성에는 소득자 식별정보가 필요할 가능성이 높다.

**결정(2026-07-06, JC-030 Slice 0b):** [JC-030 E-Filing File PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md) — **옵션 1 서버 미저장 일회성 입력** 채택.

- 파일 생성 직전에만 식별정보를 입력받고, **DB·로그·서버 파일 스토리지에 저장하지 않는다.**
- `employee_profile`에 주민등록번호 컬럼을 **추가하지 않는다.**
- 생성 파일은 **다운로드 제공 후 서버 미보관**이 v1 기본이다.
- 옵션 2(암호화 저장)·옵션 3(부가세 선회)은 **채택하지 않는다.**

구현 시 Zod 검증·tenant 격리·로그 마스킹은 Pre-Code Brief에서 구체화한다.

### 5.3 적합성 검정·표시 문구

**Validation (Path 1 & 2):** 인증·적합성 검정은 SemuAgent 제품 범위 밖.

- 허용: `사무소 전달 전 검증`, `전달 패키지용 레코드`, `양식 파일 후보`, `홈택스 업로드 전 확인`
- 금지: `홈택스 제출 보장`, `국세청 검증 완료`, `자동 신고`, `대리 제출`

**Path 1 (self-filing non-encrypted upload file):**

- 허용: `공식 업로드 양식`, `업로드 전 사전검증`, `홈택스 업로드 안내`
- 금지: `국세청 검증 완료`, 암호화 파일 지원 주장

**암호화 파일:** UI·generator·가이드에서 제공하지 않는다.

## 6. UI Gate Direction

UI-First Gate에서는 신규 독립 화면보다 **신고지원/지급명세서 검토 화면에서 이어지는 파일 생성 패널**을 우선한다.

초안 정보 구조:

1. 대상 세목: `근로소득 간이지급명세서`
2. 데이터 상태: JC-024 준비 완료 인원, 확인 필요 인원, 식별정보 입력 필요 여부
3. 파일 규격 상태: 최신 규격 확보 여부, 귀속연도/제출주기
4. 검증 결과: 필수 필드 누락, 금액 불일치, 제출주기 오류, 식별정보 누락
5. CTA: `양식 파일 다운로드`(Path 1) / `사무소에 전달`(Path 2) / `검증 결과 보기`
6. 책임 경계: Path 1=사용자 직접 업로드 · Path 2=사무소 대리신고 · 암호화 파일=범위 밖

## 7. Pre-Code Brief Gate Requirements

Pre-Code Brief는 아래가 확정된 뒤 작성한다.

- [x] 최신 전자신고 파일 레이아웃의 출처 URL/문서명 — **간이지급(근로) 전용** ([Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md) §3). 귀속연도별 HWP는 구현 직전 재확인.
- [x] 직원 식별정보 처리 방식 — **서버 미저장 일회성 입력** ([PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md))
- [x] JC-024 데이터셋 → 전자신고 record field mapping — [Field Mapping](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md)(2026-07-07)
- [x] 파일 생성 포맷(encoding, line ending, padding, fixed-width/CSV/XML 여부) — Brief §4 · Mapping §2.1 (EUC-KR·190byte 고정 [추정])
- [x] 검증 규칙과 실패 시 UI 문구 — Mapping §7 · Brief §6
- [x] 암호화 파일·적합성 검정이 현재 범위 밖임을 UI·Brief에 명시 — Scope Gate §5.3 · Brief §6.2
- [x] 생성 파일 보관 여부와 만료/삭제 정책 — PII Policy · Brief §0 (서버 미보관)

## 8. Related Documents

- **Concept_Design**: [Product Baseline §Filing Path Priority](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- **Concept_Design**: [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md)
- **Technical_Specs**: [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- **Technical_Specs**: [Withholding Field Mapping](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md)
- **Technical_Specs**: [Withholding Pre-Code Brief](./39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md)
- **Technical_Specs**: [JC-034 GIWA Handoff Scope Gate](./34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) — 구현 보류
- **Technical_Specs**: [JC-023 Hometax Autosubmit Research](./13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md) — 파일변환신고·적합성 검정 리서치
- **Technical_Specs**: [JC-030 E-Filing File PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md) — PII 일회성 입력 정책
- **Technical_Specs**: [JC-030 Simplified Wage E-Filing Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md) — 간이지급 레이아웃 입수 경로
- **Technical_Specs**: [JC-030 Simplified Wage Field Mapping](./29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md) — A/B/C 필드 매핑
- **Technical_Specs**: [JC-030 E-Filing File Pre-Code Brief](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md) — 구현 계약
- **Technical_Specs**: [Payment Statement Pre-Code Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md) — JC-024 데이터셋·주민번호 제외 경계
- **Logic_Progress**: [Backlog JC-030](../04_Logic_Progress/00_BACKLOG.md) — 전자신고 파일 생성·검증 Context Lock
