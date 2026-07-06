# JC-030 Slice 0a — 원천징수이행상황신고서 전자신고 레이아웃 입수
> Created: 2026-07-07 04:25 KST
> Last Updated: 2026-07-07 04:25 KST

## 0. Flow Status

```text
[Flow]
현재: Path 1 세목 확대 — 원천징수 layout acquisition (Slice 0a)
Gate: 최신 HWP·정오표 입수 + Field Mapping 초안 전 코드 착수 금지
완료: 공식 문서 정체성·입수 경로·홈택스 관문·JC-012/013 데이터 가설
다음: 홈택스 자료실에서 최신 HWP 다운로드 → Field Mapping(38) → Pre-Code Brief
선행 완료: 근로소득 간이지급 — [28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)
```

라벨 — **[확실]** 공식 URL·제도 안내 확인 · **[추정]** 실무 SW·2차 안내 · **[미확인]** SemuAgent 미다운로드 HWP 내부 필드·레코드 정의

## 1. Purpose

Path 1 **다음 세목**은 **원천징수이행상황신고서**(월·반기 원천세 신고)의 전자신고(변환) 파일이다
([Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)).

Slice 0a는 구현에 필요한 **공식 레이아웃 문서의 정체성·입수 경로·제출 관문**을 고정한다.
HWP/PDF 원문은 git에 보관하지 않으며, Field Mapping·Pre-Code Brief 착수 직전에
**제출 대상 귀속월의 최신 HWP+정오표**를 다운로드한다.

## 2. Critical Distinction — 혼동 금지

| 구분 | 연말 지급명세서 | 간이지급명세서(근로) | **JC-030 대상: 원천징수이행상황신고서** |
|---|---|---|---|
| 제품 목적 | 소득자료(지급조서) 제출 | 소득자료(반기·간이) 제출 | **원천징수세액 신고·납부** |
| 제출 주기 | 연 1회 | 반기(→2027~ 월) | **매월 10일**(반기납부 사업자는 예외) |
| SemuAgent 트랙 | JC-024 year-end prep | JC-024 simplified + JC-030 완료 | **JC-012 급여 · JC-013 신고지원** |
| 공식 레이아웃 묶음 | `지급명세서 전산매체 제출요령`(홈택스 1175 등) | `간이지급명세서(근로소득) 전산매체 제출요령` | **`원천징수` / `원천징수이행상황` 전산매체 제출요령** [미확인: 정확 문서명] |
| 홈택스 메뉴 | 지급명세·자료 / 전산매체 제출 | 일용·간이지급 / 변환 파일제출 | **신고/납부 → 원천세 → 변환제출** [확실·관문] |
| 파일명 접두 | 지급명세서 규격(세목별) | `SC`+사업자번호 | **[미확인 — HWP 필요]** |

**판정:** bulletin **1175** 연말 지급명세서·**간이지급 전용 HWP**·**부가세 전자신고 규격**과 **다른 문서**를 입수해야 한다.

## 3. Official Acquisition Path (Candidate — 입수 대기)

### 3.1 1순위 — 홈택스 자료실

- URL: https://www.hometax.go.kr/ → **자료실**
- 검색 키워드(우선순):
  1. `원천징수이행상황신고서 전산매체 제출요령`
  2. `원천징수 전산매체 제출요령`
  3. `원천징수이행상황` + `정오표`
  4. `원천세` + `전산매체` + `제출요령`
- 기대 산출물: HWP 제출요령 + **정오표** (+ ZIP·PDF 책자 가능)
- 귀속/제출 시점: **귀속월·지급월별 정오표 갱신 가능** → 구현·제출 직전 최신본 필수 [확실]

### 3.2 2순위 — 국세청 누리집 국세청 프로그램 게시판

- 목록: https://www.nts.go.kr/nts/na/ntt/selectNttList.do?bbsId=1099&mi=2544
- 검색: `원천징수`, `원천징수이행`, `원천세 전산매체`
- 참고: 게시판에는 **지급명세서**·**간이지급** 게시가 많고, 원천징수이행상황 전용 게시는
  **별도 검색이 필요**할 수 있음 [미확인]
- 구조 참고 게시(연말 지급명세서 묶음, 2019): nttSn **85417** — 원천징수이행상황과 **무관**

### 3.3 3순위 — 국세청 원천세 안내·공지

- 원천징수 개요: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7701&mi=2289
- 원천징수이행상황신고서 제도·납부: 관할 세무서·홈택스 **신고/납부** 안내 [확실]
- 제출 직전 해당 월 **공지/보도**에 전산매체 요령 재게시 여부 확인 [추정]

### 3.4 레거시·보조 경로 (참고만)

- 과거 **원천세 전자신고** 데스크톱 변환 프로그램(홈택스 프로그램 안내) 언급 — 현행은
  **웹 홈택스 변환제출**이 주류 [추정]. 레이아웃은 동일 계열일 수 있으나 HWP로 확정 필요.
- 민간 급여 SW 매뉴얼(더존·신규 등): 변환제출 순서 참고만. **레이아웃 확정 근거로 사용 금지**.

### 3.5 문의(필드·코드표 불명 시)

- 국세청 **126**
- 원천세과 원천2팀: **044-204-3348, 3349** (연말 지급명세서 안내와 동일 연락처 인용) [확실]

### 3.6 입수하지 않는 경로

- 연말 `지급명세서 전산매체 제출요령`(1175 등) — **지급조서용**
- `간이지급명세서(근로소득) 전산매체 제출요령` — **JC-030 1차 완료 세목**
- 부가세 전자신고 규격 — **별도 세목(Path 1 후순위)**

## 4. Hometax Submission Path (변환제출)

JC-030 생성 파일의 사용자 제출 관문(자동 제출 아님) [확실·관문, 세부는 실무·2차 안내]:

1. 홈택스 로그인
2. **신고/납부** → **원천세** (원천징수이행상황신고)
3. **변환제출방식(회계프로그램이용 등)** 선택
4. 회계·급여 프로그램(또는 SemuAgent)이 생성한 **암호화 전자파일** 업로드
5. **파일 형식 검증** → 사용자가 설정한 **전자신고 암호 8~15자리** 입력
6. **내용 검증** → **전자파일 제출** (공동인증서·간편인증 등 사용자 인증)

JC-013 신고지원은 동일 세목에 대해 **홈택스 직접 입력 가이드·값 복사**를 제공한다.
JC-030 Path 1은 **변환제출용 파일 생성**을 담당한다.

직접작성 제출(홈택스 화면 입력)은 JC-013 범주이며, SemuAgent Path 1과 **병행 가능**하나
동일 데이터 정합이 필요하다.

## 5. File Format Overview (Pre-Code Brief 입력용)

공식 HWP **미입수** 상태에서 확정 가능한 개요만 기록한다.

| 항목 | 내용 | 근거 |
|---|---|---|
| 신고 서식 | 소득세법 시행규칙 **원천징수이행상황신고서**(다쪽·부표) | 법령·실무 [확실] |
| 원본 레이아웃 매체 | 국세청 HWP `…전산매체 제출요령` + `정오표` | JC-023·간이지급 선례 [확실] |
| 레코드 구조 | 고정길이 record type·순서·오류검증 — HWP에 정의 | 동일 패턴 [추정] |
| 배포 파일 | fcrypt 등으로 **암호화**된 전자파일; 홈택스 **NTS-CRYPTO** 복호화 | JC-023 §2.1 · [31_NTS_CRYPTO](./31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md) [확실] |
| 암호 | 제작 시 **8~15자리**; 홈택스 검증 시 동일 | 실무 [확실] |
| 파일명·접두 | 간이지급 `SC…`와 **다를 가능성 높음** | [미확인 — HWP 필요] |
| 인코딩·레코드 폭 | HWP 명시 따름 | [미확인] |
| 근로소득 행 | 인원·지급액·결정세액·기납부세액 등 **집계 칸** | 실무 오류 메시지(C94 코드 등) [추정] |
| 지방소득세 | 원천징수이행상황신고서 내 **특별징수분** 또는 별도 위택스 | JC-027과 정합 필요 [추정] |

## 6. SemuAgent Data → File (초기 가설, Field Mapping에서 검증)

| SemuAgent 소스 | 원천징수 파일(가설) | 비고 |
|---|---|---|
| `payroll_period_summary.withholdingTaxKrw` | 신고서 **납부할 세액** 후보 | JC-012 집계 |
| `payroll_period_summary` + `payroll_employee_line.incomeTaxKrw` | 근로소득 **결정세액·기납부** 후보 | line 합계 |
| `payroll_employee_line.localIncomeTaxKrw` | 지방소득세 특별징수 — **위택스/JC-027과 분리** 여부 HWP 확인 | JC-027 정합 |
| `payroll_period_summary.employeeCount` | 인원 수 | |
| `payroll_period_summary.closeStatus` | export blocker (`closed` 아니면 차단) | |
| `lib/filing-support` 원천세 guide values | Field Mapping 교차 검증 | JC-013 |
| 직원별 부표·코드(C94 등) | **상세 HWP** — v1은 **근로소득 집계 행만** 후보 | 범위 축소 가능 |
| 주민등록번호 | 간이지급보다 **낮을 수 있음**(집계 신고서) — HWP 확인 | PII Policy 재검토 |

**v1 범위 가설:** SemuAgent가 이미 확정하는 **월별 근로소득 원천징수 집계**를 1차 매핑 대상으로 한다.
사업소득·이자·배당·퇴직 등 **다른 소득 구분**은 JC-012 범위 밖이면 **제외**.

## 7. Slice 0a Preconditions

- [x] v1 대상 서식 정체성 — **원천징수이행상황신고서**(지급명세서·간이지급과 분리)
- [x] 공식 입수 경로 URL·검색 키워드·게시판 기록
- [x] 홈택스 **신고/납부 → 원천세 → 변환제출** 관문 기록
- [x] JC-012·JC-013·JC-027 데이터 소스 가설
- [ ] **최신 귀속월 HWP+정오표** SemuAgent 로컬 입수 및 필드 목록 추출
- [ ] 파일명 접두·record type·인코딩 확정
- [ ] PII 범위 확정(집계-only vs 직원 부표)
- [ ] Field Mapping 문서(38) 초안

## 8. Implementation Gate

| 단계 | 게이트 |
|:---|:---|
| Field Mapping | §3에서 **제출 대상 월의 최신 HWP+정오표** 다운로드 후 `38_*_FIELD_MAPPING.md` |
| Pre-Code Brief | Field Mapping 승인 후 |
| 코드 착수 | Pre-Code Brief + UI-First Gate(신고지원 또는 급여 연동 패널) |
| UI 문구 | Scope Gate §5.3 — `국세청 검증 완료` 금지 |

## 9. Related Documents

- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [E-Filing File Generation Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [JC-030 Simplified Wage Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md) — 완료된 선례
- [JC-030 E-Filing File PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [Filing Support Pre-Code Brief](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md) — JC-013 원천세 가이드
- [Payroll Pre-Code Brief](./08_PAYROLL_PRE_CODE_BRIEF.md) — JC-012 집계
- [Logic_Progress / JC-030](../04_Logic_Progress/00_BACKLOG.md)
