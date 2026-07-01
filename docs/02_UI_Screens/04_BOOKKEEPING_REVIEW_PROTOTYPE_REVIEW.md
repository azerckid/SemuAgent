# Bookkeeping Review Prototype Review
> Created: 2026-07-01 20:20
> Last Updated: 2026-07-01 20:20

## 1. HTML UI Preview
- Preview: [기장검토](./previews/02_bookkeeping_review.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람. 회사 홈 "기장검토 열기"(다음 할 일) 또는 사이드바 "기장검토"로 진입.
- 확인 목적: 거래 분류·계정과목 확정·승인 흐름의 화면 구조, 동선, 상태별 UI

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 회사 홈·자료수집과 상호 링크.

## 3. Key User Flows
- 회사 홈 → 기장검토 진입(다음 할 일 CTA / 사이드바).
- 분류 큐에서 AI 추천 계정과목·신뢰도 확인 → 개별 승인/수정 또는 다중 선택 일괄 승인.
- 신뢰도 낮은 거래는 "계정 지정"으로 강제 확인.
- 선택 거래 상세에서 분개 미리보기·기간 귀속·부가세 공제 확인 후 승인.
- 승인 시 확정 전표로 이동(확정 탭).

## 4. Screen States
- Default: 분류 큐 + 선택 거래 상세가 채워진 화면.
- Loading: 카드·표 스켈레톤.
- Empty: 검토 대기 거래 0건 시 "확정 전표 보기" 안내.
- Error: 분류 큐 로드 실패 시 오류 + 다시 시도.
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단(구현 단계에서 확정).

## 5. Data Flow
- Inputs: tenant·회계기간, 정규화된 거래(자료수집 산출물), AI 추천 계정과목·신뢰도, 증빙/기간 귀속 메타.
- Displayed data: 분류 현황(확정/대기·진행률), 분류 큐(거래일·내용·상대처·금액·추천계정·신뢰도), 선택 거래 분개 미리보기, 기간 귀속·부가세 공제 여부.
- Mutations / saved data: 계정과목 확정/변경, 개별·일괄 승인(전표 확정). AI 추천은 초안이며 확정 책임은 사용자.
- External dependencies: AI 분류(기존 `lib/ai`), 정규화 거래(`lib/bookkeeping`). 외부 세무사 승인 흐름은 v1 제외(회사 내부 승인).

## 6. User Confirmation
- 화면/UI 선확인 여부: 확인함
- HTML Preview 확인 여부: 확인함 (브라우저 열람, 홈 ↔ 자료수집 ↔ 기장검토 상호 이동 확인)
- 확인자: 프로젝트 오너
- 확인 일시: 2026-07-01
- 보완 필요 사항: 없음 (현 방향 승인).

## 7. Feedback & Improvements
- 기장검토 방향 승인(분류 큐 + AI 추천/신뢰도 + 분개 미리보기 + 사용자 확정 책임 흐름). 후속: 01_UI_DESIGN.md 기장검토 컴포넌트 반영, BACKLOG JC-010 + Context Lock 추가.

## 8. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 (4c. 기장검토)
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **UI_Screens**: [Source Collection Prototype Review](./03_SOURCE_COLLECTION_PROTOTYPE_REVIEW.md) - 선행 화면(자료수집)
- **UI_Screens**: [HTML Preview](./previews/02_bookkeeping_review.html) - 브라우저 확인용 프로토타입
