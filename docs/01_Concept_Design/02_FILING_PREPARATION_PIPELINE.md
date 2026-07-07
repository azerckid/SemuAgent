# Filing Preparation Pipeline Product Direction
> Created: 2026-07-04 17:13
> Last Updated: 2026-07-07 23:29 KST

## 1. Purpose

이 문서는 SemuAgent의 JC-029 화면 방향을 세무 일정(달력·기한표)에서 신고 준비(신고 데이터 준비 파이프라인)로 재정의한다.

핵심 전환은 다음이다.

- 달력은 커모디티다. 기한을 보여주는 것만으로는 제품 차별점이 약하다.
- SemuAgent의 차별점은 확정 데이터 준비 여부와, **Path 1 홈택스 업로드용 양식·파일**을 만들 수 있는지다.
- 베타에서는 Path 1만 제공한다. Path 2(사무소 handoff)는 Path 1 베타 이후, Path 3(인증·암호화)은 정부 적합성 검정·인증 경로가 확인된 뒤 검토한다.
- 따라서 세무 일정은 독립 화면의 중심이 아니라 신고 준비 화면 안의 한 섹션으로 내려간다.

## 2. Product Decision

JC-029의 이름과 목적을 다음처럼 바꾼다.

| 이전 | 이후 |
|---|---|
| 세무 일정 허브 | 신고 준비 현황 허브 |
| 언제까지 무엇을 해야 하는가 | 신고서에 넣을 확정 데이터가 준비됐는가 |
| 일정표·커버리지 read-only 허브 | 공통 기반 + 병렬 신고 트랙의 준비 상태 화면 |
| 달력/기한 중심 | 데이터 준비·검토·handoff 중심 |

SemuAgent는 신고서를 대신 제출하지 않는다. 베타의 신고 완료 경로는 **Path 1 하나**다
([Product Baseline §3 Filing Path Priority](./01_PRODUCT_BASELINE.md)).

- **Path 1 (현재·베타):** SemuAgent가 홈택스 업로드용 양식·파일 후보를 만들고, 사용자가 값을 확인한 뒤 홈택스에서 직접 업로드·제출한다.
- **Path 2 (후순위):** Path 1 베타 이후 기존 세무회계사무소로 넘길 ZIP handoff를 검토한다.
- **Path 3 (미래):** 정부 적합성 검정·인증·암호화 경로가 확인된 뒤 착수한다.
- 홈택스 화면에 값을 옮겨 적도록 안내하는 직접입력 경로는 베타 범위가 아니다.

## 3. Mental Model

신고 준비는 단일 선형 파이프라인이 아니다. 항상 켜져 있는 공통 기반 위에, 신고 종류별 병렬 트랙이 각자의 주기로 돈다.

    공통 기반(always-on)
    자료수집 -> 기장검토 -> 확정 거래원장
                             ├─ 원천세(월)
                             ├─ 부가세(분기)
                             ├─ 지급명세서/연말정산(연)
                             └─ 지방소득세(본세 종속)
                                          -> 공통 검증(JC-030 Validation)
                                          -> Path 1: 양식 파일 + 홈택스 업로드 안내 -> 사업자 직접 제출
                                             (Path 2/3은 Path 1 베타 이후 후속)

### 공통 기반

- 자료수집: 회사가 업로드한 세금계산서·카드·통장·영수증·급여 자료를 수집하고 누락을 찾는다.
- 기장검토: 수집 자료를 귀속기간·중복·계정분류 기준으로 검토해 확정 거래원장으로 만든다.

### 병렬 트랙

- 원천세: 급여대장·지급내역에서 매월 신고 수치를 준비한다.
- 부가세: 매출·매입 세금계산서와 공제 검토를 기반으로 부가세 초안값을 준비한다.
- 지급명세서/연말정산: 연간 지급내역과 직원 정보를 기반으로 제출용 명세서 데이터를 준비한다.
- 지방소득세: 확정된 본세·원천세 수치에 종속해 지방세 신고 수치를 준비한다.

## 4. Responsibility Boundary

SemuAgent의 책임 경계는 명확하다.

- SemuAgent는 신고서에 넣을 확정 데이터를 준비한다.
- SemuAgent는 Path 1의 홈택스 업로드용 양식·파일 후보, 사전검증, 업로드 안내를 제공한다.
- 사용자는 다운로드 전 양식에 채워질 값을 확인하고, 홈택스에서 직접 업로드·제출한다.
- Path 2 handoff 패키지(JC-034)는 Path 1 베타 이후 검토한다.
- Path 3 인증·암호화 파일은 미래 범위이며, Path 1 plain 파일 한계는 UI에 명시한다.
- 홈택스 화면 직접입력 안내는 Path 1 완료 경로가 아니며 베타 범위에서 제외한다.
- 자동 제출은 JC-023의 별도 법무·보안·사용자 승인 게이트 없이는 도입하지 않는다.
- 홈택스/위택스 자격증명 원문, 공동인증서 비밀번호, 은행·카드 비밀번호는 저장하지 않는다.
- 세무대리인 알선·마켓플레이스·기장료 중개는 하지 않는다.

## 5. Data Contracts

| 트랙 | 입력 | 산출 | handoff |
|---|---|---|---|
| 자료수집 | 회사/담당자 업로드 | 수집 현황 + 누락 목록 | 기장 가능 상태 |
| 기장검토 | 수집자료 + 귀속기간 | 귀속월 확정 · 중복제거 · 계정분류 후보 | 확정 거래원장 |
| 원천세 | 급여대장 · 지급내역 | 간이세액표 집계 | Path 1: 원천세 양식·파일(다음 세목) |
| 부가세 | 매출 · 매입 세금계산서 | 매입/매출세액 집계 + 검증 | Path 1: 부가세 양식·파일(후순위) |
| 지급명세서/연말정산 | 연간 지급내역 | 명세서 데이터셋 · 검토 상태 | Path 1: 간이지급명세서 파일(완료) |
| 지방소득세 | 확정 본세 · 원천세 | 특별징수분 지방소득세 집계 | Path 1: 위택스/홈택스 업로드용 양식·파일(후순위) |

## 6. First Scope

이번 JC-029 범위는 목표 구조를 문서와 HTML Preview에 고정하는 것이다.

포함한다.

- 사이드바 메뉴명: 세무 일정 -> 신고 준비
- 화면명: 신고 준비
- 공통 기반(자료수집 -> 기장검토)과 병렬 트랙(원천세·부가세·지급명세서/연말정산·지방소득세) 구조
- 트랙별 입력·산출·handoff 표시
- 세무 일정은 하단/보조 섹션으로 표시
- Path 1 책임 경계 표시: SemuAgent는 양식·파일 준비, 사용자는 홈택스 업로드·제출
- Path 2·3은 후속 경로로만 표시하거나 숨긴다

제외한다.

- 지급명세서·지방소득세 신규 산출 엔진 구현
- 신규 DB 테이블 설계
- 세액 계산 로직 추가
- 홈택스/위택스 자동 제출
- 사용자 자격증명 저장 또는 제출 자동화

## 7. Relation To Existing IA

기존 IA의 세무 일정 아이디어는 폐기하지 않는다. 다만 중심 프레임을 바꾼다.

- 일정은 신고 준비 화면 안에서 다가오는 마감·D-day를 보여주는 보조 정보가 된다.
- 주요 정보구조는 무엇을 언제 해야 하는가가 아니라 각 신고 트랙의 입력·산출·handoff가 준비됐는가다.
- 이후 JC-024~028 기능은 이 화면의 각 트랙에 꽂힌다.

## 8. Related Documents

- **Concept_Design**: [Product Baseline — Path 1 Beta Priority](./01_PRODUCT_BASELINE.md)
- **Technical_Specs**: [Path 1 Form Fill Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) - 홈택스 양식 기입·세목 확대 순서 (최우선)
- **Technical_Specs**: [Path 1 End-to-End Filing Readiness Audit](../03_Technical_Specs/40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md) - 자료수집부터 양식 채움 확인까지의 현재 상태와 갭
- **Technical_Specs**: [JC-034 GIWA Handoff Scope Gate](../03_Technical_Specs/34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) - v1 ZIP Export 범위 (구현 보류)
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 신고 준비 화면 흐름과 데이터 입출력
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 신고 준비 화면 컴포넌트와 내비게이션 규칙
- **UI_Screens**: [Filing Preparation Preview](../02_UI_Screens/previews/08_filing_preparation.html) - 브라우저 확인용 HTML Preview
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-029 Context Lock
- **Technical_Specs**: [Hometax Autosubmit Research](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md) - 자동제출 후속 전략과 법적 경계
