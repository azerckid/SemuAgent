# Product Purpose UI Alignment Brief

> Created: 2026-07-14
> Status: Slices A-C implementation complete · Slice D1 complete · D2 pending

## 0. 목적

SemuAgent의 목적은 회사가 업로드한 자료를 대조·정리하고, 누락·중복·불일치와 절세 가능성을 찾아, 홈택스·위택스에 확인하거나 입력할 값을 사용자가 이해할 수 있게 보여주는 것이다. 실제 화면은 이 업무를 돕는 정보만 남겨야 한다.

이번 정합화는 전체 UI 감사를 근거로 진행하며, 큰 변경을 한 PR에 섞지 않는다.

## 1. 확인된 사실

- 자료대조원장은 fixture 전용 화면이 아니라 tenant·기간 범위의 live read model을 기본으로 사용한다.
- 다만 기간 전환·검색·표시·일괄 처리의 일부 조작은 아직 비활성이고, 중복 의심 탐지는 주 사용자 동선에 충분히 연결되지 않았다.
- 회사 홈·자료수집·기장검토·급여·리마인드에는 HTML Preview 검토용 상태 데모와 설명이 런타임에 남아 있었다.
- 회사 홈의 `확정 신고` 선택기는 실제 신고 상태나 mutation과 연결되지 않은 정적 표시였다.
- 연간신고·지급명세서·리마인드·설정 일부 문구에 `handoff`, `track`, `JC-*`, `Path 1b`, `Billing` 같은 내부 용어가 노출됐다.
- 온보딩·사업장 관리·설정에는 회계사무소 제품에서 이어진 다사업장·담당자·업무메일 개념이 남아 있다.

## 2. 고정 순서

1. **Slice A · UI 신뢰 정리**
   - 정상 런타임 화면의 상태 데모·Preview 설명 제거
   - 데이터와 연결되지 않은 상태 선택기 제거
   - 내부 개발 용어를 사용자 업무 언어로 교체
2. **Slice B · 자료대조원장 핵심 흐름 강화**
   - 기간·검색·표시·안전한 일괄 처리
   - 중복 의심 거래의 원장 진입과 해결 흐름
   - 구현 계약: [59_RECONCILIATION_LEDGER_CORE_FLOW_BRIEF.md](./59_RECONCILIATION_LEDGER_CORE_FLOW_BRIEF.md)
3. **Slice C · 회사 직접사용 셸 정리**
   - 온보딩 직후 단일 회사 흐름
   - 설정의 사무소 중심 기능 분리와 사용자 용어 정리
   - 구현 계약: [60_COMPANY_DIRECT_SHELL_CLEANUP_BRIEF.md](./60_COMPANY_DIRECT_SHELL_CLEANUP_BRIEF.md)
4. **Slice D · 공통 패턴 정리**
   - blocker·신고값 안내·기간 선택 패턴 공통화
   - 홈택스·위택스 안내 수준 정렬
   - UI-First 계약: [61_SHARED_FILING_UI_PATTERNS_BRIEF.md](./61_SHARED_FILING_UI_PATTERNS_BRIEF.md)
   - 구현 순서: D1 blocker 표시 공통화 → D2 기간 컨텍스트 → D3 포털 안내 수준 정렬

## 3. Slice A 계약

### 3.1 제거

- `화면 상태 예시`, `Preview 안내`, `Preview 계약 반영` 상시 블록
- 실제 데이터·액션과 연결되지 않은 회사 홈 `확정 신고` 선택기
- 사용자 화면의 내부 작업번호·경로명·개발 용어

### 3.2 유지

- 각 라우트의 실제 `loading.tsx`, `error.tsx`, 데이터 기반 Empty 상태
- 세무 계산, DB read/write, API, tenant/사업장 범위, 권한 검증
- HTML Preview의 상태 예시. 이는 설계 검토 자료이며 런타임 UI가 아니다.

### 3.3 사용자 문구

| 내부 표현 | 사용자 표현 |
|:---|:---|
| 신고 handoff | 신고값 준비 |
| 병렬 신고 트랙 | 신고 항목별 준비 |
| handoff: ... | 홈택스·위택스에서 확인할 값 |
| JC-024 / JC-027 | 준비 예정 |
| JC-030 / Path 1b | 홈택스 직접작성 값 |
| Billing | 요금제 |

## 4. Side-Effect Isolation

- Slice A는 표시 계층과 정적 문구만 변경한다.
- 데이터 로더·mutation·세액 계산·마이그레이션은 변경하지 않는다.
- 자료대조원장 기능 강화, 설정 구조 개편, 공통 컴포넌트 리팩터는 후속 Slice로 분리한다.

## 5. 완료선

- 핵심 다섯 화면의 정상 상태 DOM에 Preview 데모가 없다.
- 회사 홈에 정적 `확정 신고` 선택기가 없다.
- 신고 준비와 설정의 실제 사용자 화면에 내부 작업번호와 영어 운영 용어가 없다.
- 기존 실제 Loading/Empty/Error 처리와 데이터 액션은 회귀하지 않는다.
- 타입·전체 테스트·린트·whitespace·브라우저 데스크톱/모바일 검증을 통과한다.

## 6. Related Documents

- [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md)
- [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- [Backlog](../04_Logic_Progress/00_BACKLOG.md)
- [Runtime UI Trust Test Scenarios](../05_QA_Validation/11_RUNTIME_UI_TRUST_TEST_SCENARIOS.md)
- [Company Direct-Use Shell Cleanup Brief](./60_COMPANY_DIRECT_SHELL_CLEANUP_BRIEF.md)
- [Shared Filing UI Patterns Brief](./61_SHARED_FILING_UI_PATTERNS_BRIEF.md)
