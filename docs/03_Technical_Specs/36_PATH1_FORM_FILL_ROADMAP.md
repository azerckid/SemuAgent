# Path 1 — Hometax Form Fill Roadmap
> Created: 2026-07-07 04:20 KST
> Last Updated: 2026-07-07 04:40 KST

## 0. Governing Principle

SemuAgent의 **1순위 구현**은 Filing **Path 1** 이다.

1. 홈택스·국세청이 제공하는 **공식 전자신고 양식·전산매체 규격**을 입수한다.
2. SemuAgent가 이미 준비한 **신고 준비 데이터**를 양식 필드에 매핑·기입한다.
3. **plain 전자신고 파일** + **사전검증** + **홈택스 변환제출 안내**를 제공한다.
4. 최종 업로드·제출은 **사용자가 홈택스에서 직접** 한다 (JC-023 자동제출 전).

Path 2 (JC-034 GIWA ZIP)와 Path 3 (인증·암호화)는 Path 1 Validation·세목 확대 **이후**에 이어간다.

관련: [Product Baseline §3](../01_Concept_Design/01_PRODUCT_BASELINE.md) · [JC-030 Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)

## 0.1 Flow Status

```text
[Flow]
현재: Path 1 세목 확대 — 홈택스 양식 기입·신고 보조가 최우선
완료: 근로소득 간이지급명세서 — layout·mapping·Path 1 구현 (JC-030)
다음: 원천세 — 바이너리 스펙 입수 → UI-First → 구현 1a ([Layout](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md) Slice 0b 완료)
보류: JC-034 Path 2 ZIP 구현 (문서만 완료, 코드 착수 대기)
미래: Path 3 fcrypt·적합성 검정
```

## 1. Repeatable Pipeline (세목 공통)

각 세목은 아래 순서를 따른다. **이전 세목이 Path 1까지 완료되기 전 다음 세목 구현 착수 금지** (layout 병렬 입수는 허용).

| 단계 | 산출물 | 게이트 |
|:---|:---|:---|
| **A. Layout Acquisition** | `3x_*_LAYOUT_ACQUISITION.md` — HWP/요령 URL, 정오표, 입수일 | 공식 출처 URL 확정 |
| **B. Field Mapping** | `3x_*_FIELD_MAPPING.md` — record·필드·JC 데이터 소스 | A 승인 |
| **C. Pre-Code Brief** | `3x_*_PRE_CODE_BRIEF.md` — Zod·API·UI·검증 | B 승인 |
| **D. Implementation** | `lib/efiling-{tax-type}/` + 화면 패널 + API | C 승인 |
| **E. Path 2 reuse** | JC-034 ZIP 해당 트랙 CSV (선택) | D Validation 안정 |

코드 모듈 패턴 (간이지급 참조):

- `lib/efiling-simplified-wage/` — build-records, validate, hometax-guide, panel-summary

## 2. Tax Type Matrix

| 순서 | 세목 | 데이터 소스 (live) | 양식 입수 | Path 1 구현 | 비고 |
|:---:|:---|:---|:---:|:---:|:---|
| 1 | **근로소득 간이지급명세서** | JC-024, JC-015 | 완료 | **완료** | 반기; 2027~ 월 제출 전환 대비 |
| 2 | **원천세 신고서** | JC-012, JC-013, JC-027 | **Slice 0b 완료** | 없음 | [37](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md) · [38](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md) |
| 3 | **부가가치세** | JC-011, JC-013 | 미확정 | 없음 | 분기; 레이아웃 입수 경로 선행 조사 |
| 4 | **지방소득세(원천 특별징수)** | JC-027 | 위택스 별도 | 없음 | 원천세 Path 1 후 또는 병렬 layout 조사 |
| 5 | **사업장현황신고** | JC-028 | 미착수 | 없음 | 면세 개인; 홈택스 직접 입력 비중 큼 |
| — | 연말 지급명세서(1175) | JC-024 year-end prep | 별도 요령 | 없음 | 간이지급과 레이아웃 분리 |
| — | 종합소득세·법인세 | JC-025/026 | 후순위 | 없음 | 법무 게이트 |

**다음 착수 세목 (2026-07-07 확정):** **원천세 신고서** — 월 주기·급여 데이터 정합·JC-013 신고지원과 직결.

부가세는 SemuAgent 핵심 세목이나 **전자신고 파일 레이아웃 공식 입수 경로가 미확정**이므로 원천세 다음 순위로 둔다.

## 3. Next Item — 원천세 신고서 (JC-030 확장)

### 3.1 착수 전 작업 (코드 없음)

1. [x] `37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md` — Slice 0a·0b (2026-07-07)
2. [x] 참조 PDF 입수 (별지 제21호·NTS 작성요령) — 바이너리 HWP는 **미발견**
3. [x] `38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md` — A01↔JC-012/013 (Part A)
4. [x] `39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md` — 초안
5. [ ] 바이너리 레이아웃 (`전자신고 이용안내` / 변환프로그램)
6. [x] UI-First Gate — filing-support 원천세 JC-030 패널 HTML ([05_filing_support.html](../02_UI_Screens/previews/05_filing_support.html))
7. [x] Slice 1a — 서식 검증·JC-013 대조 패널 (다운로드 비활성)

### 3.2 완료 정의 (Path 1)

- 사용자가 선택한 귀속월 원천세 데이터로 plain 전자신고 파일 생성
- JC-030 Validation blocking 시 다운로드 차단
- 홈택스 변환제출 단계 안내 (JC-013 가이드와 정합)
- `국세청 검증 완료` 표시 금지 (Path 3 전)

## 4. Relationship To Other Paths

| Path | 이 로드맵과의 관계 |
|:---|:---|
| **Path 1** | 본 문서 — **최우선** |
| **Path 2 (JC-034)** | 각 세목 Path 1 Validation 출력을 ZIP에 포함. **구현은 Path 1 세목 2개 이상 안정 후** |
| **Path 3** | plain 파일 한계 대체. 인증·fcrypt 후 |
| **JC-013** | 홈택스 **수동 입력 가이드**는 유지; Path 1이 **파일 생성**을 담당 |

## 5. Documentation Sync Checklist

Path 1 우선순위 반영 시 아래 문서가 일치해야 한다.

- [x] [Product Baseline §Strategic](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- [x] [JC-030 Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [x] [Backlog JC-030 / JC-034](../04_Logic_Progress/00_BACKLOG.md)
- [x] [Screen Flow §4g](../02_UI_Screens/00_SCREEN_FLOW.md)
- [x] [UI Design §4.10](../02_UI_Screens/01_UI_DESIGN.md)
- [x] [Filing Preparation Pre-Code Brief](./15_FILING_PREPARATION_PRE_CODE_BRIEF.md)
- [x] [JC-034 Scope Gate](./34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) — 구현 보류 명시

## 6. Related Documents

- **Technical_Specs**: [Withholding Layout Acquisition](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md) — Slice 0b
- **Technical_Specs**: [Withholding Field Mapping](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md)
- **Technical_Specs**: [Withholding Pre-Code Brief](./39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md)
- **Technical_Specs**: [JC-030 Simplified Wage Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md) — 완료된 1번 세목 참조
- **Technical_Specs**: [JC-030 Pre-Code Brief](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md)
- **Technical_Specs**: [JC-034 Pre-Code Brief](./35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md) — Path 2, 구현 대기
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md)
