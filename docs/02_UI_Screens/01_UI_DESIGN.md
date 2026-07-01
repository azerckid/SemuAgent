# JARYO Company UI Design
> Created: 2026-07-01 19:40
> Last Updated: 2026-07-01 20:35

## 1. 디자인 방향

- 성격: B2B 세무·회계 운영 도구. 신뢰감·가독성·밀도 우선. 장식보다 정보 명료성.
- 기반: JARYO-GIWA의 shadcn/ui + Tailwind 자산 재사용. 중립(zinc/slate) 팔레트.
- 톤: 마케팅적 과장 없음. 첫 화면부터 "작동하는 제품"(대시보드).
- 이모지 미사용, 상태는 색상 + 텍스트 라벨로 이중 전달.

## 2. 디자인 토큰 (HTML Preview 기준)

| 토큰 | 값 | 용도 |
|:---|:---|:---|
| bg | `#f6f6f7` | 앱 배경 |
| surface | `#ffffff` | 카드·패널 |
| border | `#e4e4e7` | 기본 경계선 |
| fg | `#18181b` | 본문 텍스트 |
| fg-muted | `#71717a` | 보조 텍스트 |
| accent | `#2563eb` | 주요 강조·링크 |
| ok / warn / danger | `#16a34a` / `#d97706` / `#dc2626` | 상태 (완료/주의/위험) |
| radius | `12px` | 카드 모서리 |

상태칩은 각 색상의 soft 배경 + 동일 색 테두리로 표현한다 (ok/warn/danger/muted).

## 3. 레이아웃 구조

```
┌───────────┬─────────────────────────────────────┐
│  Sidebar  │  Topbar (화면명 · 회사명 · 기간선택)   │
│  248px    ├─────────────────────────────────────┤
│           │  Content (max 1200px)                │
│  브랜드    │   1) 회계기간 Hero (진행률·마감 D-day) │
│  네비게이션 │   2) 다음 할 일 (신고 전 blockers)     │
│  (홈 활성) │   3) 준비 현황 카드 3열 그리드          │
│           │   4) 최근 제출·영수증 테이블            │
│  사용자    │   5) 화면 상태 예시(로딩/빈/오류)       │
└───────────┴─────────────────────────────────────┘
```

- Sidebar: 브랜드 → "회사 홈"(활성) → 운영 흐름(자료수집·기장검토·부가세·급여·신고지원) → 관리(설정) → 사용자.
  아직 미구현 화면은 "다음" 배지로 표기.
- Topbar: 회계기간·신고구분 선택 pill을 우측 정렬. 컨텍스트 전환의 단일 지점.

## 4. 핵심 컴포넌트

### 4.1 회사 홈 (00_company_home.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| 회계기간 Hero | 현재 기간·진행률·마감일 강조 | 진행 중 / 마감 임박(D-day 강조) |
| Action Row | 신고 전 해결 항목 + CTA | danger/warn/ok dot로 우선순위 |
| Status Card | 워크스페이스 집계 요약 | 값 + 상태칩, 클릭 시 라우팅 |
| Recent Table | 제출·영수증 이력 | 구분·항목·기간·상태·일시 |
| State Card | 로딩/빈/오류 표준 | 스켈레톤·빈안내·오류+재시도 |

### 4.2 자료수집 (01_source_collection.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Completeness Header | 수집 완결성 진행률 + 미수집 건수 강조 | 진행률 바 + 우측 카운트 |
| Upload Dropzone | 회사 내부 파일 업로드 진입점 | 지원 형식·용량 안내 + primary "파일 선택" |
| Source Type Tile | 자료유형별(세금계산서/통장/카드/영수증) 집계·정규화 상태 | ok(정규화 완료) / warn(미수집) / blue(정규화 대기) |
| Import Status Table | 업로드→파싱→정규화 진행 상황 | mini-progress 바 + 상태칩, 파싱 오류는 danger + "다시 시도" |
| Missing Checklist | 신고 전 확보해야 할 자료 목록 + CTA | warn/ok dot, "다시 업로드"·"정규화 확인" |
| State Card | 로딩/빈/오류 표준 (홈과 공용) | 스켈레톤·빈안내·오류+재시도 |

- 상태칩 색상 규약은 두 화면 공통(ok/warn/danger/muted/blue). 표·카드·상태 예시(State Card)는 화면 간 재사용한다.
- 자료수집은 mutation(업로드·정규화)이 발생하므로, 업로드/재시도 CTA에 진행(mini-progress)·오류(danger) 상태를 명시적으로 노출한다.

### 4.3 기장검토 (02_bookkeeping_review.html)

| 컴포넌트 | 역할 | 상태 |
|:---|:---|:---|
| Classification Header | 거래 분류 현황(확정/대기)·진행률 강조 | 진행률 바 + 우측 대기 카운트(danger) |
| Queue Tabs | 검토 대기 / 신뢰도 낮음 / 확정 / 전체 필터 | 세그먼트 탭(active 강조) + 건수 배지 |
| Bulk Action Bar | 다중 선택 일괄 승인·계정 변경 | primary "선택 N건 승인" + ghost "일괄 변경" |
| Classification Queue Table | 거래별 AI 추천 계정과목·신뢰도·처리 | 체크박스 + AI 배지 + Confidence Bar + 행 액션(승인/수정/계정 지정) |
| Confidence Bar | AI 추천 신뢰도 시각화 | high(ok) / mid(warn) / low(danger), 낮으면 "계정 지정" 강제 |
| Journal Entry Preview | 확정 전 분개(차변/대변) 미리보기 | `card` 내 전표 표(부가세대급금 포함), 차·대변 합계 일치 표시 |
| Period Attribution / Approval | 귀속 기간·증빙·부가세 공제·승인 | 속성 리스트 + 상태칩 + "이 거래 승인" |
| State Card | 로딩/빈/오류 표준 (공용) | 스켈레톤·빈안내(확정 전표 보기)·오류+재시도 |

- 사이드바 "기장검토"에는 검토 대기 건수 카운트 배지(danger)를 노출한다.
- AI 추천은 초안이며 확정 책임은 사용자에게 있다. 신뢰도 낮은 항목은 승인 전 "계정 지정"으로 강제 확인시킨다.
- 상태칩·State Card·Table 골격은 회사 홈/자료수집과 공통(DRY).

### 4.4 화면 간 내비게이션

- 사이드바 항목·브랜드·breadcrumb를 모두 `<a>`로 처리(`a { color: inherit; text-decoration: none }`).
- 회사 홈 → 자료수집: 사이드바 "자료수집" + Action Row "자료수집 열기".
- 회사 홈 → 기장검토: 사이드바 "기장검토" + Action Row "기장검토 열기".
- 자료수집/기장검토 → 회사 홈: 사이드바 "회사 홈" + 브랜드 + 상단 breadcrumb.
- 화면 간(자료수집 ↔ 기장검토)도 사이드바로 직접 이동.
- 구현된 화면은 사이드바 "다음" 배지를 제거한다.

## 5. 핵심 CTA 우선순위

**회사 홈**
1. 다음 할 일의 워크스페이스 진입 버튼 (가장 강한 primary, brand 색 채움)
2. 준비 현황 카드 클릭 (전체 카드가 클릭 대상)
3. 기간 선택 pill (컨텍스트 전환)

**자료수집**
1. 업로드 드롭존 "파일 선택" (primary, brand 색 채움)
2. 파싱 오류·미수집 항목의 "다시 업로드 / 정규화 확인"
3. 수집 상태 표의 행별 "보기 / 다시 시도"

**기장검토**
1. "선택 N건 승인" / "이 거래 승인" (primary, brand 색 채움)
2. 신뢰도 낮은 거래의 "계정 지정" (승인 전 강제 확인)
3. 행별 "승인 / 수정", 탭 전환(검토 대기/신뢰도 낮음/확정/전체)

## 6. HTML UI Preview

- Preview (회사 홈): [00_company_home.html](./previews/00_company_home.html)
- Preview (자료수집): [01_source_collection.html](./previews/01_source_collection.html)
- Preview (기장검토): [02_bookkeeping_review.html](./previews/02_bookkeeping_review.html)

## 7. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 및 데이터 입출력
- **UI_Screens**: [MVP UX Baseline](./01_MVP_UX_BASELINE.md) - 6개 워크스페이스 기준선
- **UI_Screens**: [Company Home Prototype Review](./02_COMPANY_HOME_PROTOTYPE_REVIEW.md) - 회사 홈 확인 결과
- **UI_Screens**: [Source Collection Prototype Review](./03_SOURCE_COLLECTION_PROTOTYPE_REVIEW.md) - 자료수집 확인 결과
- **UI_Screens**: [Bookkeeping Review Prototype Review](./04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) - 기장검토 확인 결과
- **UI_Screens**: [HTML Preview 폴더](./previews/) - 브라우저 확인용 프로토타입
