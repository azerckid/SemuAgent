# Test Scenarios: Filing Support
> Created: 2026-07-02 20:23
> Last Updated: 2026-07-13 KST

신고지원(JC-013) Layer 5 QA 시나리오. [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md)의
Data Contract·Derivation·Mutation·Acceptance를 검증 케이스로 옮긴다.

핵심: **Preview UI 계약 준수**, 부가세·급여 산출물 연동, 신고 준비값 확인, 접수증 보관,
사후 체크리스트, 자동 제출/납부 비범위, tenant/사업장 범위 격리.

표기: Result 범례 - `PASS·단위` / `PASS·구현` / `Pending`(도메인별 후속 E2E).

## 1. Rubric Validation (Mandatory)

| Criterion | Status | Evidence |
|:---|:---:|:---|
| Functionality | PASS·구현 | 신고 항목 read model, 접수증 보관 기록, 체크리스트 mutation 구현 |
| Potential Impact | PASS·구현 | 회사 직접 신고 보조의 마지막 워크스페이스 |
| Novelty | PASS·구현 | 자동 제출 대신 책임 경계와 패키지·가이드·보관을 결합 |
| UX | PASS·구현 | 승인 Preview 4.6 섹션 순서와 주요 문구를 정적 테스트로 고정. 화면 구현 후 브라우저 렌더 검증 완료 |
| Open-source | PASS·구현 | VAT/payroll read model 재사용 + filing 전용 테이블 최소 추가 |
| Business Plan | PASS·구현 | 신고지원 패키지와 접수증 보관은 유료 가치의 핵심 사용 증거 |

## 2. Test Scenarios & Results

### 2.1 기본 렌더 및 구조

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증 tenant + 사업장 + VAT/payroll 산출물 | `/dashboard/filing-support` 진입 | 책임 경계 배너 -> 신고 항목 -> 준비값 확인/접수증 -> 체크리스트 순서 | PASS·구현 |
| S-02 | 사이드바 "신고지원" | 클릭 | `/dashboard/filing-support` 이동 | PASS·구현 |
| S-03 | 승인 Preview 기준 데이터 | 렌더 | 부가세 패키지 대기, 원천세 패키지 준비됨, 4대보험 확인 필요 흐름 재현 | PASS·단위 |
| S-04 | 하단 안내 | 렌더 | 자동 제출/납부가 아니라 패키지·준비값 확인·접수증 보관까지임을 표시 | PASS·구현 |

### 2.2 기간·사업장 컨텍스트

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-10 | `?period=2026-H1` | 진입 | 2026년 1기 부가세 + 2026년 6월 귀속 급여 기준으로 집계 | PASS·단위 |
| S-11 | query 없음 | 진입 | 최신 신고 대상 기간으로 기본 선택 | PASS·구현 |
| S-12 | 사업장 없음 | 진입 | "부가세·급여 먼저 확정" 또는 사업장 등록 안내 빈 상태 | PASS·구현 |
| S-13 | tenant A/B 데이터 | tenant A 로더 | B filing item/receipt/checklist 미노출 | PASS·단위 |
| S-14 | businessEntity A/B | A 컨텍스트 | B VAT/payroll/filing 데이터 미집계 | PASS·단위 |

### 2.3 신고 항목·패키지 상태

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-20 | VAT pendingDeductionCount=3 | 렌더 | 부가세 항목 "패키지 대기", 버튼 disabled + locknote | PASS·단위 |
| S-21 | VAT pendingDeductionCount=0, packageStatus=ready | 렌더 | 부가세 패키지 생성/열기 가능 | PASS·단위 |
| S-22 | payroll withholdingStatementStatus=generated, closeStatus=closed | 렌더 | 원천세 항목 "패키지 준비됨" | PASS·단위 |
| S-23 | payroll insuranceStatementStatus 미생성 또는 noticeImportStatus!=matched | 렌더 | 4대보험 항목 "확인 필요" | PASS·단위 |
| S-24 | 선행 산출물 없음 | 렌더 | 해당 항목은 locked/needs_review로 표시하고 선행 화면 CTA 제공 | PASS·구현 |

### 2.4 신고 준비값 확인

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-30 | payroll employeeCount=12 | 원천세 가이드 렌더 | 인원 12명 표시 | PASS·단위 |
| S-31 | payroll grossPayKrw=42,600,000 | 원천세 가이드 렌더 | 총지급액 42,600,000원 표시 | PASS·단위 |
| S-32 | payroll withholdingTaxKrw=2,100,000 | 원천세 가이드 렌더 | 소득세/지방소득세 합계 또는 세부 값 표시 | PASS·단위 |
| S-33 | 신고 준비값 확인 영역 | 렌더 | 확정 값은 화면에 표시되지만 홈택스 직접입력용 복사 버튼은 제공하지 않음 | PASS·구현 |
| S-34 | 홈택스 가이드 영역 | 렌더 | "자동 제출 아님" 문구 표시 | PASS·구현 |

### 2.5 접수증 보관

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-40 | 원천세 접수증 파일 | 업로드 | `filing_receipt` 생성, private storage key 저장 | PASS·구현 |
| S-41 | 저장된 접수증 | 렌더 | 파일명/제출일/보관 완료 표시 | PASS·단위 |
| S-42 | 부가세 접수증 없음 | 렌더 | "제출 후 업로드 대기" 빈 상태 표시 | PASS·단위 |
| S-43 | 다른 tenant receiptId | 보기/삭제 | 404/403, 데이터 미노출 | PASS·구현 |
| S-44 | storageKey 존재 | 렌더 | private storage key·Blob URL 미노출 | PASS·단위 |

### 2.6 사후 체크리스트

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-50 | checklist item incomplete | 체크 | completed=true, completedBy/At 기록 | PASS·구현 |
| S-51 | checklist item complete | 체크 해제 | completed=false, completedAt null 또는 갱신 | PASS·구현 |
| S-52 | 원천세 납부 완료 | 렌더 | 완료 항목은 muted/line-through 스타일 | PASS·구현 |
| S-53 | 다른 tenant checklistId | mutation | 404/403, 데이터 변경 없음 | PASS·구현 |

### 2.7 책임 경계·비범위

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-60 | 신고지원 화면 | 정적 분석 | 홈택스 제출 API, 납부 API, credential 저장 API 없음 | PASS·구현 |
| S-61 | 화면 문구 | 렌더 | "신고서 제출을 대행하지 않습니다" 표시 | PASS·구현 |
| S-62 | 버튼/CTA | 렌더 | "제출하기", "납부하기"처럼 시스템이 수행하는 오해 문구 없음 | PASS·구현 |
| S-63 | 코드 검색 | 정적 분석 | 홈택스/EDI 자동 로그인·스크래핑·공동인증서 저장 import 없음 | PASS·구현 |

### 2.8 Preview 계약·GIWA 경계

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | 신고지원 컴포넌트 | 정적 분석 | GIWA 메일/요청/외부 고객 포털 컴포넌트 미import | PASS·구현 |
| S-71 | 화면 순서 | 정적 분석 | Preview 4.6의 4개 주요 섹션 순서 유지 | PASS·구현 |
| S-72 | disabled CTA | 렌더 | 잠금 버튼은 `disabled` + `aria-disabled=true` + visible locknote | PASS·구현 |
| S-73 | 사이드바 | 렌더 | 신고지원 route 활성 상태와 count 배지 표시 | PASS·구현 |

### 2.9 상태(State) 커버리지

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | 페치 지연 | 진입 | 스켈레톤 loading | PASS·구현 |
| S-81 | 신고 항목 0건 | 진입 | "아직 신고할 항목이 없습니다 / 부가세·급여 먼저 확정" | PASS·구현 |
| S-82 | 로드 실패 | 진입 | "신고 항목을 불러오지 못했습니다" + 다시 시도 | PASS·구현 |
| S-83 | 미인증 | 접근 | `/sign-in` redirect | PASS·구현 |
| S-84 | tenant 없음 | 진입 | tenant-scoped 접근 차단 | PASS·구현 |
| S-85 | 급여·지급 사이드바 | 지급명세서와 연말정산을 각각 선택 | 서로 다른 route·breadcrumb·전용 표를 표시하고 각 화면 준비율에 다른 화면 상태를 섞지 않음 | PASS·단위/정적/브라우저 |
| S-86 | 2026년 7월, 연말정산 `period` 미지정 | 연말정산 진입 | 최근 완료 연도 2025년을 기본 선택하고 2026년 1~7월 부분합을 연간 검토 준비로 표시하지 않음 | PASS·단위/브라우저 |
| S-87 | 2026년 7월, 연말정산 `?period=2026-H1` | 진행 중 연도 열기 | 완료 월 누락만 검사하고 정상 행은 `연도 진행 중`, 금액 헤더는 `현재까지 지급합계`, 확인 필요·검토 준비에는 포함하지 않음 | PASS·단위/브라우저 |

### 2.10 Path 1a Tax-Type File Completion (Pending)

이 시나리오는 [Path 1 Roadmap §2.1](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md)의
세목별 **Path 1a(양식·파일)** 완료선을 검증한다. 원천세는 공식 조사 결과 공식 비암호화
업로드 양식이 없어 **Path 1b(직접입력 정리) 대상으로 결정**됐고 1b 화면을 구현했으므로
1a W1~W5를 시작하지 않는다. 부가세도 Path 1b 대상이며(Mapping·Preview·Pre-Code·runtime·browser 검증 완료), Stage A
공개 자료 감사에서는 현재 회계프로그램 파일변환 메뉴와 일부 첨부서류 도구를 확인했지만
최신 비암호화 수용은 미확인이라 Stage A는 1a 승격용 선택 조사다. Stage A가 양식을 확인한
세목만 S-91~S-99를 전용 fixture로 반복하며, 1a가 없는 세목은 아래 §2.11의 Path 1b 값 정리
시나리오로 검증한다(모두 Pending). 어떤 세목도 `blocked`로 두지 않는다.

지방소득세 특별징수는 위택스 공식 매뉴얼에서 `B070101-02.xlsx` 엑셀파일신고 경로가
확인되어 첫 Path 1a 후보가 됐다. 다만 로그인 원본을 입수하지 않았으므로 아래 지방소득세
전용 원본·매핑·수용 시나리오를 통과하기 전에는 Preview나 generator를 구현하지 않는다.

근로소득 지급명세서는 국세청 공식 안내에서 직접작성 또는 자체 프로그램 변환제출만
확인되어 Path 1b 대상으로 판정됐다. Stage B는 전체 법정 필드를 ownership별로
매핑했고, Stage C는 급여 기초자료를 SemuAgent 정본, 공제신고서와 최종 지급명세서를
홈택스 정본으로 확정했다. 아래 Stage D Preview 승인을 받기 전 runtime을 만들지 않는다.
사업장현황신고는 면세 개인사업자 조건부 시나리오로 후순위에 둔다.

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-90 | 공식 비암호화 업로드 양식 | 구현 착수 | 출처·버전·적용일·파일 형식·양식 구조·홈택스 직접 수용 메뉴가 문서화되지 않으면 generator 코드를 시작하지 않음 | Pending |
| S-91 | Stage A를 통과한 세목의 확정 신고 기간 | 양식 채움 확인 렌더 | 사업자·기간·세액·부속명세 값이 생성 양식 값과 동일 | Pending |
| S-92 | 해당 세목의 자료대조·공제검토·귀속·합계 blocker 중 하나 존재 | Preview 또는 generate API | 동일한 blocker code/message로 다운로드 차단 | Pending |
| S-93 | 정상 대표 fixture | 공식 비암호화 파일 생성 | 파일명·확장자·시트/표/열 구조·필수 필드·합계가 공식 양식과 일치 | Pending |
| S-94 | 같은 입력 fixture | 두 번 생성 | byte-for-byte 동일한 파일 생성 | Pending |
| S-95 | tenant A/B·사업장 A/B·귀속월 A/B 데이터 | tenant A/사업장 A/귀속월 A 생성 | 선택 범위 이외 데이터가 파일에 포함되지 않음 | Pending |
| S-96 | 일회성 입력과 생성 파일 | 생성·다운로드 후 | 파일·PII·자격증명·원문 payload가 서버 DB/storage/log에 영구 저장되지 않음 | Pending |
| S-97 | 브라우저 다운로드 | 성공/오류/경고 상태 확인 | 실제 파일 다운로드, 정확한 filename/content type, 복구 가능한 오류 안내 | Pending |
| S-98 | 생성된 대표 비암호화 파일 | 홈택스/위택스 공식 파일 업로드 검증 | 암호화·별도 변환 없이 수용되거나, 미수용이면 해당 세목은 1a generator를 배포하지 않고 Path 1b(직접입력 정리)로 제공 | Pending |
| S-99 | Path 1a 화면·가이드 | 렌더 | 단계별 위치 안내·자동제출·자격증명 저장·암호화 업로드·세무대리 문구가 없고 사용자 직접 업로드 책임을 표시 | Pending |
| S-1A-LI0 | 위택스 공개 공식 자료 | Stage A-1 감사 | `B070101-02.xlsx` 다운로드·엑셀파일신고·검증·제출 경로와 회계파일 경로의 분리가 출처와 함께 기록됨 | PASS·문서 |
| S-1A-LI1 | 로그인 위택스 공식 Excel 원본 | 원본 입수 | 원본 SHA-256·입수일·메뉴·시트·열·유효성·숨김/보호/수식이 기록되고 자격증명·쿠키·PII는 기록하지 않음 | Pending |
| S-1A-LI2 | 고정된 공식 Excel 구조와 JC-027 정본 | Field Mapping | `localIncomeTaxKrw`는 실제 저장값을 사용하고 과세표준·가감세액·관할지 등 정본 없는 값은 0·10%·gross 값으로 추정하지 않고 blocker로 남김 | Pending |
| S-1A-LI3 | 대표 fixture로 만든 공식 Excel | 위택스 파일 검증 | 민간 회계파일·비밀번호·암호화·별도 변환 없이 수용되고 Preview 값·파일 값·위택스 검증 결과가 일치 | Pending |

### 2.11 Path 1b Direct-Entry Input Guide (간이지급·원천세·부가세 완료)

공식 비암호화 업로드 양식이 없는 세목(간이지급명세서·원천세·부가세 등)은 Path 1b 대상으로 결정됐다.
간이지급명세서는 홈택스 직접작성 경로와 소득자별 근무기간·월 지급액·합계를, 원천세는
홈택스 메뉴 경로·기본정보·A01 ④⑤⑥ 위치와 확정값을 함께 보여주는 화면을 구현했고,
부가세는 법정 신고서 행·칸 Mapping·HTML Preview·scoped read model·runtime을 구현했고 browser 검증을 남겼다.
Path 1b는 파일 generator·자동입력·자동제출을 만들지 않는다.

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-1B0 | 원천세 확정 신고 기간 | 신고지원 화면 렌더 | 검증과 동일 read model의 확정값이 기본정보·A01 ④⑤⑥ 위치에 표시 | PASS·단위/브라우저 |
| S-1B1 | 자료대조·귀속·합계 blocker 존재 | 원천세 1b 안내 렌더 | 입력 전 확인에 미확정 사유가 표시되고 지급연월 미확정 값은 경고 | PASS·단위/브라우저 |
| S-1B2 | 원천세 1b 화면 | 렌더 | 홈택스 메뉴 경로·입력칸 위치·값이 표시되고 파일 다운로드·자동입력·자동제출·세무대리 문구가 없음 | PASS·정적/브라우저 |
| S-1B3 | tenant A/B·사업장 A/B·귀속월 A/B | tenant A 범위 진입 | 선택 범위 이외 값이 요약에 섞이지 않고 PII가 서버에 영구 저장되지 않음 | Pending |
| S-1B4 | provenance가 확인된 부가세 확정값 | VAT Path 1b 렌더 | 일반과세자 정기 확정신고의 법정 행 번호·금액·세액이 같은 scoped read model에서 표시 | PASS·단위/정적 |
| S-1B5 | blocked/empty/stale/unsupported 상태 | VAT Path 1b 진입 | 이전 기간 값을 확정값처럼 표시하지 않고 상태별 다음 행동을 안내 | PASS·단위/정적/브라우저(blocked) |
| S-1B6 | 신고서 직접 입력 행·자동 합계 행·최종세액 행 | VAT Path 1b 렌더 | 각각 `값 비교·수정`·`자동 합계 대조`·`홈택스 최종 확인`으로 구분 | PASS·단위/정적 |
| S-1B7 | SemuAgent ㉰ 소계와 홈택스 `(27)` 최종세액 | VAT Path 1b 렌더 | 두 값을 동일하게 표시하지 않고 `(27)`은 홈택스 계산값으로 확인 | PASS·단위/정적 |
| S-1B8 | VAT Path 1b 화면 | 정적 분석 | AI 근거·증빙 workflow를 반복하지 않고 파일 생성·자동입력·자동제출·스크린샷 클릭 튜토리얼이 없음 | PASS·정적 |
| S-1B9 | 간이지급 준비 완료 소득자 | 지급명세서 화면 렌더 | 홈택스 직접작성 경로와 근무기간·반기 6개월 지급액·지급총액·인정상여가 동일 read model에서 표시 | PASS·단위 |
| S-1B10 | 월별 지급액 합계가 반기 지급총액과 다름 | 간이지급 Path 1b 렌더 | `직접작성 전에 확인` blocker로 표시하고 준비 완료처럼 표시하지 않음 | PASS·단위 |
| S-1B11 | 간이지급 Path 1b 화면 | 정적 분석 | 파일 후보·PII 입력 폼·plain 다운로드·변환제출 안내·자동입력·자동제출이 없음 | PASS·정적 |
| S-1B12 | 소득자 식별정보 | 간이지급 Path 1b 렌더 | 앱 입력란 없이 `홈택스에서 직접 입력`으로 표시하고 DB/API로 전송하지 않음 | PASS·정적 |
| S-1B13 | 2026년 7월, `period` 미지정 | 지급명세서 진입 | 진행 중인 하반기가 아니라 최근 완료 반기인 `2026-H1`을 기본 선택 | PASS·단위/브라우저 |
| S-1B14 | 2026년 7월, `?period=2026-H2`, 7월 급여만 존재 | 지급명세서·Path 1b 렌더 | 8~12월을 누락으로 세지 않고 `기간 진행 중`으로 표시하며 확인 필요 0명·직접작성 값 0명으로 분리 | PASS·단위/브라우저 |
| S-1B-AW0 | 국세청 2025 원천징수의무자 신고안내·주요서식 | 근로소득 지급명세서 Stage A 감사 | 직접작성·자체 프로그램 변환제출·법정 HWP를 구분하고, 공식 비암호화 업로드 양식 미확인으로 Path 1b 판정 | PASS·문서 |
| S-1B-AW1 | 근로소득 지급명세서 법정/홈택스 필드 전체 | Stage B Field Mapping | 각 필드가 canonical source·canonical 확장·홈택스 직접입력·신뢰 source 필요·v1 제외 중 하나로 빠짐없이 분류 | PASS·문서 |
| S-1B-AW2 | 공제·과세표준·결정세액·환급/추징 정본 없음 | Stage B mapping 판정 | 연간 지급액·기납부세액에서 역산하거나 0으로 채우지 않고 UI-First NO-GO와 source blocker로 기록 | PASS·문서 |
| S-1B-AW3 | 승인된 Stage D 근로소득 지급명세서 준비 모델 | runtime 렌더 | 동일 tenant·사업장·연도의 확정 급여 기초자료와 홈택스 생성 경로를 표시하고 주민등록번호·변환파일·자동제출을 저장/생성하지 않음 | Pending |
| S-1B-AW4 | 확정 연말정산 결과·신고 사업자 profile·민감정보 정본이 현재 모델에 없음 | Stage C canonical source 계약 | 홈택스 생성 결과를 최종 정본으로 두고 SemuAgent 급여 기초자료·사업자 profile ownership·PII 비저장 경계를 승인하며 세액 계산·역산·결과 import를 제외 | PASS·문서 |
| S-1B-AW5 | Stage C 책임 계약과 대표 급여 fixture | Stage D HTML Preview 렌더 | 간결한 홈택스 생성 흐름과 직원별 급여 준비값·`급여 준비 완료/급여 보완/특례 확인`만 표시하고 전체 제24호서식·최종세액·PII 입력·중복 카드를 표시하지 않음 | Pending |
| S-1B-BS0 | 일반 과세 개인사업자 또는 법인 | 사업장현황신고 진입·navigation | 비대상 사업자에게 메뉴·미완료 badge·신고 blocker를 노출하지 않음 | Pending |

## 3. 자동화 계획

- **단위 테스트 완료** (`lib/filing-support/summary.test.ts`): S-03, S-10, S-13~14, S-20~23, S-30~32, S-41~44, S-50~52.
- **정적 검증 완료** (`filing-support-workspace.test.ts`): Preview 구조(S-01, S-70~73), route(S-02), 책임 경계 문구(S-61~62), 자동 제출/납부 미제공(S-60, S-63), mutation guard 배선(S-40~43, S-50~53).
- **API 구현 완료**: receipt metadata upload/delete, checklist toggle, tenant/staff guard(S-40~43, S-50~53). 실제 Blob 저장 환경은 JC-014에서 검증 완료.
- **브라우저 수동 검증 완료**: `/dashboard/filing-support?period=2026-H1` 로그인 렌더와 승인 Preview 구조를 확인.
- **후속 E2E**: JC-014에서 실제 Blob·AI 파싱·정규화 저장은 통과했다. 실제 홈택스/EDI 접수증 파일 포맷별 업로드는 별도 fixture 확보 후 검증한다.
- **Path 1a 파일 후속**: 간이지급명세서와 원천세는 공식 비암호화 업로드 양식을 확인하지 못해 Path 1b 화면을 구현했다. 간이지급의 과거 고정길이 후보 생성 UI는 제거했다. 부가세도 Path 1b Mapping·Preview·Pre-Code·runtime·browser 검증을 완료했다. 지방소득세 특별징수는 위택스 공식 `B070101-02.xlsx` 엑셀파일신고가 확인된 첫 Path 1a 후보이며, S-1A-LI1~LI3 통과 전에는 generator를 시작하지 않는다. 근로소득 지급명세서는 Path 1b 대상이고 S-1B-AW1~AW4를 통과했다. 다음은 S-1B-AW5 Stage D Preview이며, 오너 승인 뒤에만 S-1B-AW3 runtime을 만든다. 사업장현황신고는 S-1B-BS0 대상성 gate가 선행한다. Stage A가 양식을 확인한 정확한 파일 범위에만 S-91~S-99를 적용하며, S-98 전에는 어떤 세목도 Path 1a `done`으로 표시하지 않는다. 1a가 없는 세목은 §2.11 Path 1b 시나리오로 검증한다. 어떤 적용 세목도 `blocked`로 두지 않는다.

## 4. Related Documents

- **UI_Screens**: [Filing Support Prototype Review](../02_UI_Screens/07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/05_filing_support.html)
- **Technical_Specs**: [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md) · [Annual Wage Stage C Contract](../03_Technical_Specs/57_JC030_ANNUAL_WAGE_STATEMENT_CANONICAL_SOURCE_CONTRACT.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- **Technical_Specs**: [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md) · [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md)
- **Technical_Specs**: [Path 1 Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) · [Withholding Pre-Code Brief](../03_Technical_Specs/39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md) · [Path 1 E2E Audit](../03_Technical_Specs/40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md) · [Annual Wage Stage A Audit](../03_Technical_Specs/55_JC030_ANNUAL_WAGE_STATEMENT_STAGE_A_AUDIT.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-013 Context Lock
- **QA_Validation**: [VAT Test Scenarios](./05_VAT_TEST_SCENARIOS.md) · [Payroll Test Scenarios](./06_PAYROLL_TEST_SCENARIOS.md) - 선행 화면 QA 패턴
