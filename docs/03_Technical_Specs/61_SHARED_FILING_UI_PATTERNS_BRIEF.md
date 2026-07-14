# Shared Filing UI Patterns Pre-Code Brief

> Created: 2026-07-14
> Last Updated: 2026-07-14
> Status: UI-First Gate pending owner approval

## 0. 목적

JC-042 Slice D는 신고 준비 화면에 반복되는 세 가지 표시 패턴을 공통 계약으로 묶는다.

1. 해결해야 할 blocker 목록
2. 현재 기간과 이전·다음 이동
3. 홈택스·위택스에서 확인할 값과 사용자 행동

공통화는 세무 로직을 합치는 작업이 아니다. 각 도메인의 정본·상태 계산·라우팅은 유지하고, 사용자가 읽는 순서와 상태 표현만 통일한다.

## 1. 확인된 중복

- `filing-preparation-hub`, 지급명세서, 지방소득세, 사업장현황신고가 사실상 같은 blocker 행을 각각 구현한다.
- 회사 홈·자료수집·자료대조원장·부가세·급여·연간신고가 기간을 서로 다른 위치와 밀도로 표시한다.
- 홈택스 직접작성 화면은 경로·입력 위치·책임 경계를 상세히 보여주지만, 위택스 화면은 값 집계와 범위 밖 설명에 머물러 포털 안내 수준이 다르다.
- 지방소득세 위택스 엑셀파일신고 경로와 공식 파일명은 확인됐지만 원본 획득·수용 검증 전이므로 파일 생성 가능 상태로 표시할 수 없다.

## 2. UI-First 계약

오너 확인 대상은 [17_shared_filing_patterns.html](../02_UI_Screens/previews/17_shared_filing_patterns.html)이다.

### 2.1 ActionBlockerList

최소 표시 필드:

```ts
type ActionBlockerItem = {
  id: string
  title: string
  description: string
  tone: 'warn' | 'danger'
  href: string
  ctaLabel: string
}
```

- 항목 0건이면 `null`을 반환한다.
- 항목당 CTA는 한 개만 허용한다.
- `danger`는 다음 단계 차단, `warn`은 확인 권장을 뜻한다.
- 원본 도메인 blocker 타입을 대체하지 않고 표시 직전에 구조 호환으로 전달한다.
- 모바일에서는 CTA가 제목 아래로 이동하며 텍스트와 겹치지 않는다.

### 2.2 PeriodContextControl

최소 표시 필드:

```ts
type PeriodContext = {
  label: string
  value: string
  previousHref?: string
  nextHref?: string
}
```

- 실제 URL 상태가 있는 화면만 이전·다음 이동을 제공한다.
- 이동을 지원하지 않는 화면은 `label + value`만 표시한다.
- 기간 기본값·마감 여부·미래 기간 차단은 기존 도메인 로더가 결정한다.
- 공통 컴포넌트는 URL을 계산하거나 기간을 추정하지 않는다.

### 2.3 FilingPortalGuide

최소 표시 필드:

```ts
type FilingPortalGuideItem = {
  portal: 'hometax' | 'wetax'
  scopeLabel: string
  readiness: 'ready' | 'source_pending'
  preparedValueLabel: string
  userActionLabel: string
  externalHref: string
}
```

- 홈택스와 위택스를 같은 필드·순서로 표시한다.
- `ready`는 현재 정본으로 확정값 또는 입력 위치를 보여줄 수 있다는 뜻이다.
- `source_pending`은 값 일부는 준비됐지만 공식 양식 원본·수용 경로가 확인되지 않았다는 뜻이다.
- `source_pending`에 파일 다운로드·업로드 가능·검증 완료 문구를 표시하지 않는다.
- 외부 포털 링크는 새 탭으로 열며 자격증명을 앱에 저장하지 않는다.

## 3. 첫 runtime 범위

### D1 · 표시 공통화

1. 공통 `ActionBlockerList`를 추가한다.
2. 신고 준비 허브·지급명세서·지방소득세·사업장현황신고의 중복 blocker DOM을 교체한다.
3. 데이터 로더·blocker 생성 함수·CTA 목적지는 변경하지 않는다.

### D2 · 기간 컨텍스트

1. 공통 `PeriodContextControl`을 추가한다.
2. 기간 이동을 이미 지원하는 화면부터 적용한다.
3. 읽기 전용 화면에는 현재 값만 표시한다.

### D3 · 포털 안내 수준 정렬

1. 공통 `FilingPortalGuide`를 추가한다.
2. 홈택스 직접작성 화면과 지방소득세 화면에 같은 정보 순서를 적용한다.
3. 위택스 원본 미확인 상태를 명시하고 Stage A 결과가 바뀔 때만 상태를 승격한다.

각 단계는 별도 PR로 진행한다. D1은 표시 refactor라 Preview 승인 후 먼저 구현하고, D2·D3는 적용 화면별 회귀 범위를 다시 확인한다.

## 4. Side-Effect Isolation

- DB·migration·API·세액 계산·gate 계산은 변경하지 않는다.
- 각 도메인의 blocker·기간·신고값 read model은 정본으로 유지한다.
- 공통 컴포넌트는 표시 전용이며 서버 mutation을 호출하지 않는다.
- 외부 포털 링크 외에 네트워크 요청을 추가하지 않는다.
- 기존 Loading·Empty·Error·권한 없음 상태를 변경하지 않는다.

## 5. 완료선

- 네 화면의 blocker가 같은 구조와 반응형 동작을 사용한다.
- 기간 선택은 Topbar 한 위치에 있고, 지원되지 않는 이동 컨트롤을 만들지 않는다.
- 홈택스·위택스가 같은 정보 순서로 표시된다.
- 위택스 원본 미확인 상태가 업로드 가능으로 오해되지 않는다.
- 타입·전체 테스트·린트·whitespace·데스크톱/모바일 브라우저 확인을 통과한다.

## 6. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 직접사용·신고 보조 경계
- **UI_Screens**: [Shared Filing UI Patterns Prototype Review](../02_UI_Screens/17_SHARED_FILING_PATTERNS_PROTOTYPE_REVIEW.md) - 오너 확인 계약
- **UI_Screens**: [Shared Filing UI Patterns Preview](../02_UI_Screens/previews/17_shared_filing_patterns.html) - 브라우저 확인 화면
- **Technical_Specs**: [Product Purpose UI Alignment Brief](./58_PRODUCT_PURPOSE_UI_ALIGNMENT_BRIEF.md) - Slice D 순서
- **Technical_Specs**: [Local Income Tax Form Audit](./54_JC030_LOCAL_INCOME_TAX_UPLOAD_TEMPLATE_ACQUISITION.md) - 위택스 양식 확인 상태
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-042 실행 상태
- **QA_Validation**: [Runtime UI Trust Test Scenarios](../05_QA_Validation/11_RUNTIME_UI_TRUST_TEST_SCENARIOS.md) - 공통 패턴 검증 시나리오
