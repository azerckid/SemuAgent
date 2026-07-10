# Path 1 — Hometax Form Fill Roadmap
> Created: 2026-07-07 04:20 KST
> Last Updated: 2026-07-11

## 0. Governing Principle

SemuAgent의 **1순위 구현**은 Filing **Path 1** 이다.

1. 홈택스·국세청·위택스가 제공하고 해당 사이트가 직접 수용하는 **공식 비암호화 업로드 양식**을 입수한다.
2. 자료수집과 자료대조원장을 통과한 **확정 신고 데이터**만 공식 필드에 매핑한다.
3. 사용자가 다운로드 전에 **양식에 채워질 값**을 화면에서 확인한다.
4. SemuAgent가 공식 양식에 값을 채운 **비암호화 업로드 파일**을 생성하고 형식·정합성을 사전검증한다.
5. 사용자가 홈택스·위택스에 직접 접속해 파일을 업로드·검증·제출한다.

홈택스 화면에 값을 옮겨 적는 직접입력 가이드는 Path 1이 아니다. 자동제출,
자격증명 저장, 세무대리도 포함하지 않는다.

Path 2 (JC-034 GIWA ZIP)는 Path 1 베타 이후에만 재개한다. Path 3
(인증·암호화 파일)는 현재 제품 범위에서 제외한다. 공식 서식 HWP/PDF가 존재해도
홈택스·위택스가 그 파일을 직접 업로드받는다는 근거가 없으면 Path 1 양식으로
간주하지 않는다.

관련: [Product Baseline §3](../01_Concept_Design/01_PRODUCT_BASELINE.md) · [JC-030 Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)

## 0.1 Flow Status

```text
[Flow]
완료: 자료대조원장 Phase 2 — 확정 원장 gate, 부가세 package gate, VAT provenance/rebuild
구현 완료: 근로소득 간이지급명세서 — 양식 채움 확인, 비암호화 파일 후보, 검증, 업로드 안내; 공식 직접 수용은 beta 검증 대상
차단 종료: 원천세 W0 — 공식 경로는 직접작성 또는 비밀번호 기반 회계프로그램 변환파일
현재 제품 작업: JC-035 VAI-2 — 부가세 공식 규칙·저장 계약 승인 대기
병렬 외부 대기: 부가세 Stage A — 공개 자료 감사 완료, 로그인 화면·126 외부 확인 대기
다음 제품 작업: VAI-2 승인 후 VAI-3a read-only 규칙·패턴 추천
파일 트랙 다음: 부가세 Stage A 통과 시 B~G / 실패 시 지방소득세 특별징수 Stage A
이후: 지방소득세 특별징수 → 사업장현황신고 → 연말 지급명세서
보류: Path 2 ZIP, JC-023 자동제출
제외: Path 3 fcrypt·암호화 파일·적합성 검정
```

**Phase 2 완료는 Path 1 완료가 아니다.** Phase 2는 신고 파일이 소비할 확정
데이터와 gate를 완성한 작업이다. Path 1 완료는 아래 세목별 공식 파일 생성과
실제 비암호화 업로드 검증까지 끝났을 때 판정한다.

부가세 공식 파일 트랙이 외부 확인으로 막힌 동안 제품 구현을 멈추지 않는다. 현재
우선순위는 [JC-035 VAT AI Tax Treatment](./44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md)로,
공제/불공제/안분과 과세/영세율/면세를 근거·증빙과 함께 검토하고 사용자가 확정하는
기능이다. 이 기능은 신고 준비 품질을 높이지만 JC-030 Path 1 파일 완료로 세지 않는다.

## 1. Repeatable Tax-Type Pipeline

각 세목은 아래 순서를 따른다. 공식 규격이 없는 상태에서 파일 포맷을 추정해
코딩하지 않는다. 다음 세목의 공식 자료 조사는 병렬로 할 수 있지만, 구현은 현재
세목의 완료선 또는 명시적 외부 차단 결정 이후에만 넘어간다.

| 단계 | 산출물 | 통과 조건 |
|:---|:---|:---|
| **A. Official Upload Template Acquisition** | 공식 URL·파일·버전·입수일·업로드 메뉴·로컬 검증 기록 | 비암호화 양식의 파일 형식·구조·필수 필드·적용일과 사이트 직접 수용 여부가 확인됨 |
| **B. Field Mapping** | 공식 필드 ↔ SemuAgent 확정 데이터 소스 매핑 | 미확정 필드가 0건이거나 해당 세목 v1에서 명시적으로 제외됨 |
| **C. UI-First Gate** | 실제 양식에 채워질 값 Preview와 Prototype Review | 사용자가 화면 구조·문구·책임 경계를 승인함 |
| **D. Pre-Code Contract** | Pre-Code Brief, Zod, API, Component/Library Plan, QA 시나리오 | 저장·PII·tenant·blocking·비목표가 고정되고 사용자 승인됨 |
| **E. Implementation** | read model, 양식 채움 확인, generator, validation, download API/UI | Preview와 파일이 동일한 데이터 모델을 사용하고 blocker 우회가 불가능함 |
| **F. File Verification** | 파일 구조 fixture, 브라우저 검증, 홈택스·위택스 업로드 검증 기록 | 결정론적 파일 테스트와 실제 비암호화 파일 업로드 검증이 통과함 |
| **G. Closeout** | Backlog·Completion Contract·Audit·QA 동기화 | 문서와 main 코드 및 운영 상태가 일치함 |

공통 구현 패턴은 완료된 `lib/efiling-simplified-wage/`를 재사용하되, 세목별
공식 레이아웃은 서로 다르므로 record 포맷을 복사해 추정하지 않는다.

## 2. Completion Lines

### 2.1 Per-Tax-Type Done

한 세목의 Path 1은 다음 조건을 **모두** 만족해야 완료다.

- [ ] 제출 시점에 유효한 공식 비암호화 업로드 양식의 출처, 버전, 적용일과 직접 수용 메뉴를 확인했다.
- [ ] 모든 v1 필드를 SemuAgent 확정 데이터 또는 명시적 사용자 입력에 매핑했다.
- [ ] 자료수집·자료대조·세목별 검토 gate를 통과하지 못하면 생성이 차단된다.
- [ ] 다운로드 전에 사용자가 신고 양식, 기간, 사업자, 대상자, 합계를 확인한다.
- [ ] Preview 값과 생성 파일이 동일한 read model에서 파생된다.
- [ ] 생성 파일의 파일명·파일 형식·양식 구조·필수 필드·합계를 검증한다.
- [ ] 다른 tenant·사업장·기간 데이터가 파일에 섞이지 않는다.
- [ ] 파일은 서버에 영구 저장하지 않으며 자격증명을 수집하지 않는다.
- [ ] 브라우저에서 생성·다운로드·오류 상태를 확인한다.
- [ ] 홈택스·위택스의 공식 비암호화 파일 업로드 검증에서 대표 fixture가 통과한다.
- [ ] 사용자가 직접 업로드·제출한다는 경계를 화면에 표시한다.
- [ ] 테스트, QA, Backlog, Completion Contract가 실제 main 상태와 일치한다.

공식 비암호화 업로드 양식을 입수하지 못했거나 사이트가 해당 파일을 직접
수용한다는 사실을 검증하지 못하면 그 세목은 `blocked`이지 `done`이 아니다.
이때 바이너리 레코드나 암호화 파일을 대신 추정·구현하지 않고 다음 세목의
Stage A 조사로 이동한다.

### 2.2 Path 1 Beta Done

Path 1 베타는 최소 다음 조건을 만족해야 한다.

1. 근로소득 간이지급명세서와 **추가 1개 세목**이 각각 §2.1을 통과한다.
   원천세를 우선하되, W0에서 공식 비암호화 업로드 양식이 없다고 확인되면
   다음 세목 중 최초로 Stage A를 통과한 세목을 사용한다.
2. 두 세목 모두 대표 데이터로 양식 채움 확인 → 파일 다운로드 → 홈택스
   비암호화 업로드 검증 흐름을 완료한다.
3. beta 사용자가 실패 원인과 수정 위치를 화면에서 확인할 수 있다.
4. 직접입력, 자동제출, Path 2, 암호화 파일 없이 Path 1 한 경로로 검증한다.

Path 1 베타가 끝난 뒤에만 Path 2 구현 재개 여부를 검토한다.

### 2.3 Planned Tax Matrix Decision Done

현재 계획된 세목 매트릭스의 JC-030 의사결정 완료는 원천세, 부가세,
지방소득세 특별징수, 사업장현황신고, 연말 지급명세서가 각각 다음 중 하나에
도달한 상태다.

1. §2.1의 Path 1 파일 지원 완료선을 통과한다.
2. Stage A 공식 근거로 현재 제품 계약에 맞는 비암호화 업로드 경로가 없음을
   기록하고 `closed blocked`로 종료한다.

`closed blocked`는 해당 세목의 Path 1 파일 지원 완료를 뜻하지 않는다. Path 1
지원 범위와 베타 완료는 실제 §2.1을 통과한 세목만 센다. 종합소득세와 법인세는
법무·범위 gate가 별도이므로 이 의사결정 완료선에 포함하지 않는다.

## 3. Tax Type Matrix

| 순서 | 세목 | 확정 데이터·gate | A~D 준비 | E~F 파일 상태 | 판정 |
|:---:|:---|:---|:---|:---|:---|
| 0 | **근로소득 간이지급명세서** | JC-024·JC-015 | 완료 | 비암호화 파일 후보 생성·Preview·검증 구현; 공식 직접 업로드 수용 재검증 필요 | 구현 완료, beta 검증 대상 |
| 1 | **원천세 신고서** | JC-012·JC-013 | W0 공식 조사 완료; 직접작성 또는 비밀번호 기반 변환파일만 확인 | 실제 업로드 파일 생성 없음 | **closed blocked; W1~W5 미착수** |
| 2 | **부가가치세** | 자료대조 Phase 2·VAT deduction·provenance 완료 | 현재 홈택스 `파일 변환신고(회계프로그램)`와 2020년 일부 첨부서류 Excel 도구 확인; 최신 전체 신고 비암호화 규격 미확인 | 업로드 파일 생성 없음 | **Stage A 공개 감사 완료, 외부 확인 대기 · partial / blocked** |
| 3 | **지방소득세 특별징수** | JC-027 실제 확정값 | 위택스 공식 규격 A~D 미착수 | 업로드 파일 생성 없음 | 부가세 다음 |
| 4 | **사업장현황신고** | JC-028 read-only 준비 화면 완료 | 공식 업로드 양식 A~D 미착수 | 업로드 파일 생성 없음 | 지방소득세 다음 |
| 5 | **연말 지급명세서** | JC-024 연간 지급·기납부 원천세 준비 | 별도 레이아웃 A~D 미착수 | 업로드 파일 생성 없음 | 사업장현황신고 다음 |
| — | 종합소득세·법인세 | JC-025·026 | 법무·범위 gate 미완료 | 미착수 | 본 로드맵 후순위 |

부가세의 **자료 gate 완료**와 **홈택스 업로드 파일 완료**를 혼동하지 않는다.
Phase 2는 전자이고, JC-030 부가세 Path 1은 후자다.

## 4. Fixed Execution Order

### 4.1 Closed Track — Withholding

| Step | Work | Completion line |
|:---|:---|:---|
| **W0** | 공식 비암호화 업로드 양식·수용 경로 확인 | **조사 완료, `closed blocked`** — 직접작성 또는 비밀번호 기반 변환파일만 공식 확인 |
| **W1** | Field Mapping Part B·Brief 확정 | 미착수·차단 |
| **W2** | 동일 read model 기반 Preview·generator | 미착수·차단 |
| **W3** | generate API·download UI | 미착수·차단 |
| **W4** | 파일·브라우저·홈택스 검증 | 미착수·차단 |
| **W5** | 구현 closeout | 해당 없음; W0 차단 판정과 문서 동기화로 트랙 종료 |

원천세 W0는 [공식 근거 감사](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)에
따라 차단 종료했다. 최신 공식 비암호화 양식과 직접 수용 메뉴가 새로 확인되지 않는 한
W1~W5를 재개하지 않는다.

### 4.2 Current Product Track — VAT AI Tax Treatment (JC-035)

부가세 신고에서 사용자가 실제로 판단해야 하는 공제/불공제·안분·영세율·면세를 먼저
지원한다. 작업 단위와 완료선은 [VAT AI Completion Contract §6~7](./44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md)을 따른다.

1. **VAI-0** — Scope Contract. 완료 계약·AI 단계·비목표 고정.
2. **VAI-1** — UI-First Gate. `03_vat.html` 프로젝트 오너 승인 완료.
3. **VAI-2** — 공식 규칙 매트릭스 + Pre-Code Brief. 문서 작성 완료, 승인 대기.
4. **VAI-3~5** — read-only 추천 → 사용자 확정 → 고위험 consensus/fallback.
5. **VAI-6** — 확정 결과를 VAT rebuild/package gate에 연결하고 closeout.

JC-035는 공식 업로드 파일을 만들지 않고, 직접입력 가이드도 제공하지 않는다.

### 4.3 Parallel External Gate — VAT Path 1 File

부가세를 동일한 A~G 순서로 진행하되, 현재는 Stage A만 활성이다.

1. **VAT A** — [공식 비암호화 업로드 양식 감사](./43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md). 공개 자료 감사에서 현재 `파일 변환신고(회계프로그램)` 메뉴와 일부 첨부서류 전용 Excel 도구를 확인했다. 최신 전체 신고 양식·규격·비암호화 수용 여부는 로그인 화면 또는 126 확인 전까지 `partial / blocked`다.
2. **VAT B~G** — Stage A 통과 후에만 Phase 2 gate/provenance를 generator가 소비한다.
3. Stage A가 암호화·인증·회계프로그램 전용으로 최종 확인되면 부가세를 `closed blocked`로 닫고 지방소득세 Stage A로 이동한다.

### 4.4 Following File Tracks

부가세 종료 판정 후 각 세목을 동일한 A~G 순서로 진행한다.

1. **Local Income A~G** — 위택스 특별징수 규격과 원천세 확정값을 사용한다.
2. **Business Status A~G** — 면세 개인만 허용하고 비대상 사업자는 차단한다.
3. **Annual Statement A~G** — 간이지급 파일 레이아웃을 재사용한다고 가정하지 않는다.

각 세목의 A 단계에서 전용 Layout Acquisition 문서를 만들고, C 단계에서 신규
HTML Preview를 승인받고, D 단계에서 전용 Pre-Code Brief와 QA를 만든다.

## 5. Deferred Work

다음은 이 구현 순서에 끼워 넣지 않는다.

- Path 2 사무소 handoff ZIP (JC-034)
- Path 3 fcrypt·암호화 파일·적합성 검정
- 홈택스·위택스 자동 로그인·자동 제출 (JC-023)
- 홈택스 직접입력 안내
- 원천세 A02~A80, 환급조정, 부표, 반기납부 확장
- 종합소득세·법인세 자동 파일 생성
- 자료대조원장의 연/사용자 지정 기간, partial/many-to-one 등 보류 기능

보류 기능이 현재 세목의 정확한 파일 생성을 실제로 막는다는 증거가 생기면,
먼저 이 계약을 갱신한 뒤 별도 slice로 추가한다.

## 6. Documentation Sync Checklist

- [x] [Path 1 E2E Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md) — Phase 2 완료와 남은 파일 작업 분리
- [x] [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) — JC-030 epic/세목 완료선 분리
- [x] [Backlog JC-030](../04_Logic_Progress/00_BACKLOG.md) — 원천세 W0~W5와 후속 순서
- [x] [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md) — 실제 파일 생성 검증 시나리오
- [x] [Withholding Pre-Code Brief](./39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md) — Slice 1b 완료선
- [x] [Reconciliation Phase 2 Brief](./41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md) — §9 완료 상태 유지
- [x] [VAT Provenance Audit](./42_VAT_CONFIRMED_LEDGER_PROVENANCE_AUDIT.md) — 데이터 gate 완료, 파일 생성 비목표 확인
- [x] [Withholding W0 Final Audit](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md) — 원천세 `closed blocked` 판정
- [x] [VAT Stage A Audit](./43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md) — 공개 자료 감사 완료, 현재 회계프로그램 변환 메뉴·일부 첨부서류 도구 확인, 외부 확인 대기

## 7. Related Documents

- **Technical_Specs**: [Withholding Layout Acquisition](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
- **Technical_Specs**: [Withholding Field Mapping](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md)
- **Technical_Specs**: [Withholding Pre-Code Brief](./39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md)
- **Technical_Specs**: [VAT Stage A Audit](./43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md)
- **Technical_Specs**: [JC-030 Simplified Wage Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)
- **Technical_Specs**: [JC-030 Simplified Wage Pre-Code Brief](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md)
- **Technical_Specs**: [JC-034 Pre-Code Brief](./35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md) — Path 2, 구현 대기
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md)
- **QA_Validation**: [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
