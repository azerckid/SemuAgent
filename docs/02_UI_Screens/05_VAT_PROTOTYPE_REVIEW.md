# VAT Prototype Review
> Created: 2026-07-01 20:50
> Last Updated: 2026-07-12

## 1. HTML UI Preview
- Preview: [부가세](./previews/03_vat.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람. 회사 홈 "부가세 열기"(다음 할 일) 또는 사이드바 "부가세"로 진입.
- 확인 목적: 부가세 세액 집계·매출 구분과 함께, AI가 공제/불공제/안분·과세/영세율/면세 가능성을 근거·필요 증빙과 함께 제시하고 사용자가 확정하는 흐름의 화면 구조·동선·상태별 UI

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 회사 홈·자료수집·기장검토와 상호 링크.

## 3. Key User Flows
- 기장검토 확정 전표 → 부가세 집계 반영.
- 회사 홈 → 부가세 진입(다음 할 일 CTA / 사이드바).
- 세액 요약(매출세액 − 매입세액 = 납부 예정세액)과 마감 D-day 확인.
- 매출 구분(과세/영세율/면세) 확인.
- AI 부가세 판단: 규칙·이전 확정 패턴·AI 보강·AI 합의를 구분해 표시.
- 매입세액 공제 검토: 공제 가능성/불공제 가능성/공통매입 안분을 근거와 함께 확인하고 사용자가 확정.
- 매출 과세유형 검토: 영세율·면세 가능성은 필수 증빙과 부족한 사실을 확인한 뒤 사용자 확정.
- AI timeout·provider 실패 시 해당 행만 수동 확인으로 전환하고 나머지 화면과 mutation은 계속 사용.
- 부속 명세 준비 상태 확인 → 자료수집·자료대조·공제 검토 완료 → stale snapshot이면 `확정 원장 다시 계산` → 현재 fingerprint 확인 후 신고 패키지 생성.

## 4. Screen States
- Default: 세액 요약·매출 구분·공제 판단 작업표가 채워진 화면.
- AI unavailable: 표는 유지하고 해당 행에 `수동 확인 필요`·다시 시도를 표시. 무한 loading 없음.
- Loading: 카드·표 스켈레톤.
- Empty: 집계할 매출·매입 자료 0건 시 "기장검토 먼저 확정" 안내.
- Error: 세액 집계 로드 실패 시 오류 + 다시 시도.
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단(구현 단계에서 확정).

## 5. Data Flow
- Inputs: 기장검토 확정 전표(매출·매입), 증빙 유형, 공제/불공제 판정 근거.
- Displayed data: 매출세액·매입세액·납부(예정)세액, 과세/영세율/면세 구분, 공제 판단 한 줄과 펼쳐보기 안의 source·근거·규칙 버전·필요 증빙·사용자 확정 액션.
- Mutations / saved data: 기존 공제/불공제 확정·공통매입 안분·명시적 확정 원장 재계산은 유지한다. JC-035에서는 AI 추천과 사용자 최종 결정을 분리 저장한다. 사용자 확정 전 AI 추천은 세액·VAT fact·package gate를 변경하지 않는다.
- External dependencies: exact VAT fact·공식 규칙·이전 확정 패턴이 우선이며, 애매한 행에만 설정된 AI provider를 조건부 사용한다. provider가 없거나 실패해도 수동 검토로 전환한다. 자동 홈택스 제출은 범위 밖이다.

## 6. User Confirmation
- 화면/UI 선확인 여부: 확인함
- HTML Preview 확인 여부: 확인함 (브라우저 열람, 신고 패키지 생성 버튼 잠금 표현 확인)
- 확인자: 프로젝트 오너
- 확인 일시: 2026-07-01
- 당시 기능 승인 기준 보완 사항: 없음. 현재 정보량·중복·배치 재검토는 §6.2에서 별도 진행.

### 6.1 JC-035 VAT AI Extension Review

- 기존 JC-011 기본 화면 승인: 유지
- AI 판단 작업표·근거·필요 증빙·사용자 확정 흐름: **승인**
- 신고 준비 검토 자료가 공식 홈택스 양식 업로드 파일이 아니라는 문구: **승인**
- 추가 제품 결정: 홈택스 자동채움 내용을 확인할 때 `그대로 확인`과 `수정·추가 검토` 항목을 근거와 함께 제시한다. 실제 홈택스 자료를 가져오지 않은 경우 `홈택스 현재값`이 아니라 `자동채움 예상`으로 표시한다.
- 승인일: 2026-07-11
- 현재 구현: VAI-3a 공식 규칙·이전 확정 패턴, VAI-3b single-provider AI 보강, VAI-4a/4b 사용자 확정·되돌리기, VAI-5 조건부 multi-provider 합의, VAI-6a 공통 gate에 이어 VAI-6b가 영세율·면세 필수 증빙 `확인 완료`·`확인 취소`와 감사 기록을 판단 행에 연결한다. exact VAT fact가 없는 행은 억지로 추정하지 않고, 사용자 확정 전에는 rebuild/package를 차단한다.
- 확인 경로: `/dashboard/vat?period=2026-H1`의 영세율·불공제·안분·공제·면세 대표 행에서 액션 버튼, 판단 근거 대화상자, 최근 작업 되돌리기를 확인한다.
- 검증 완료: 실제 브라우저에서 영세율 대표 행의 확인 완료→확인 취소→재확인 라운드트립과 `부가세 사용자 판단` 게이트 사유 노출을 확인했다(샘플데이터 원상복구). migration `0070` dev/prod 적용·PR #200 머지 완료 → **JC-035 `done`**.

### 6.2 JC-038 Simplification Review Approved

- 기존 승인은 JC-035의 판단 기능·사용자 확정·gate 흐름에 대한 승인이다.
- 현재 runtime의 전체 정보량과 영역 배치가 최종 승인됐다는 뜻은 아니다.
- 프로젝트 오너는 중복 정보와 시각적 부담을 줄이는 재검토를 요청했다.
- 기본 모델은 전체 거래 재검토가 아니라 예외 검토다. 홈택스 미리채움과 deterministic rule이
  명확한 정상 건은 건수·합계로 접고, 영세율·면세·불공제·안분·누락·취소·중복·불일치만 펼친다.
- 정상 자동 정리는 세무 자동확정이 아니며 사용자가 기간 단위 요약과 신고 내용을 최종 확인한다.
- `화면 상태 예시`, 중복 매입 공제 표, 반복 차단 안내, 동작하지 않는 control을 우선 감사한다.
- 프로젝트 오너가 VUI-1a의 10개 결정을 확정하고 VUI-1b 단순화 Preview를 승인했다.
- 매출 구분 3카드는 항상 표시한다. AI 판단과 매입세액 공제 검토는 `확인 필요 거래` 한 작업대로 통합한다.
- 판단 표는 3열만 사용한다. `공제 판단` 열은 `공제 가능`·`공제 불가`·`자료 부족` 한 줄만 기본 노출하고, 홈택스 할 일·source·상태·근거·필요 증빙·재확인·사용자 액션은 펼친 뒤 표시한다.
- 화면 상태 예시·부속 명세·동작 없는 `확정 신고`·별도 정상 건 요약 배너는 삭제한다.
- 신고 준비·차단 이유·하단 책임 문구는 화면에서 제거한다. package/rebuild API gate와 판단 mutation·undo는 유지한다.
- 예외가 0건이면 긴 표 대신 완료 배너를 표시한다.
- 계약: [VAT Screen Simplification Brief](../03_Technical_Specs/48_VAT_SCREEN_SIMPLIFICATION_AND_DEDUPLICATION_BRIEF.md)

### 6.3 JC-041 VAI-9d/9e Savings Flow — Owner Approved

- 세액 요약 바로 아래에 `추가 공제 가능성`을 두고 기존 `확인 필요 거래`와 분리한다.
- 기본 행에는 거래·재분류 방향·최대 가능 금액만 표시한다. 신뢰도·근거·부족 자료는 펼쳐보기로 이동한다.
- 프로젝트 오너가 PR #229 Preview를 승인했다. runtime은 같은 배치·정보 계층을 유지하고, 펼쳐보기 안에서만 `공제로 재분류`·`접대비 유지` 액션을 제공한다.
- `공제로 재분류`는 업무 목적 또는 참석자 입력과 적격증빙 존재를 요구하며, 서버가 현재 후보 fingerprint·증빙·미확정 상태를 다시 검증한다.
- 높은/중간/낮은 후보를 모두 보여주되 badge를 늘리지 않는다.
- 후보가 0건이면 섹션을 표시하지 않는다.
- Preview 단계에는 저장·확정 버튼이 없고 canonical 값도 바꾸지 않는다.
- [VAT HTML Preview](./previews/03_vat.html)에 제안안을 반영했으며 프로젝트 오너의 실제 크기 화면 승인을 기다린다.

### 6.4 JC-039 VAI-8e Evidence and Handoff Flow — Implemented

- 기본 `공제 판단` 셀에는 결론 한 줄만 유지한다. 실제 evidence trace와 상태·행동은 펼친 상세 안에 둔다.
- evidence trace는 여섯 source 중 실제로 찾은 항목만 사용자용 source label과 요약으로 표시한다. 내부 row reference를 그대로 노출하지 않는다.
- 담당자 이관은 잠정 결론과 근거 뒤에 `담당자 확인 1가지`로 표시한다. 정확한 질문·부족/충돌 근거·답변에 따른 처리만 제공하고 generic `확인 필요` 문구를 추가하지 않는다.
- handoff 행은 추천 바로 적용을 노출하지 않는다. `답변하고 확정` 모달에서 잠정 결론을 기본 선택하되 사용자가 바꿀 수 있고, 답변과 판단 근거를 필수로 저장한다.
- 2026-07-13 로컬 샘플 DB의 `면세사업분 공통매입` 대표 행에서 `안분 필요 → 찾은 근거 → 질문 1개 → 답변하고 확정`과 모달 기본값 `안분`을 브라우저로 확인했다. canonical 저장 버튼은 검증 중 누르지 않았다.

## 7. Feedback & Improvements
- (반영) 신고 패키지 생성 버튼을 승인 전 잠금 상태로 표현: `is-disabled` + `disabled` + `aria-disabled="true"`, muted 스타일, 잠김 라벨.
- (구현 노트) disabled 버튼의 `title` 툴팁은 브라우저별로 표시가 일관되지 않는다. React 구현 시 비활성 버튼을 래퍼(예: span/tooltip 컴포넌트)로 감싸 잠금 사유를 접근성 있게 노출한다. → Component & Library Plan / JC-011 전제조건에 반영.
- (Slice 2d-3c) 승인 Preview 이후 추가된 조건부 상태: 다른 package gate가 모두 준비됐으나 저장 snapshot fingerprint만 stale이면 패키지 카드에 `확정 원장 다시 계산`을 표시한다. unresolved fact/review 상태에서는 이 버튼도 숨기고 기존 blocker 사유만 표시한다.
- (JC-035 Preview) 기존 공제검토 표를 별도 카드 추가 없이 AI 판단 작업표로 확장했다. 사용자는 한 행에서 판단 가능성·근거·필요 증빙·확정 액션을 함께 본다.
- (JC-035 경계) `영세율 가능성`·`면세 가능성`은 확정 상태가 아니다. 필요한 증빙 또는 사실이 부족하면 package gate를 해제하지 않는다.
- (VAI-6b) `확인 완료`는 AI 자동확정이나 파일 생성이 아니라 사용자가 법정 증빙 준비를 확인했다는 감사 기록이다. 사용자 확인 건만 취소할 수 있고 취소 즉시 gate를 다시 잠근다.
- (JC-035 안전성) AI 장애는 화면 전체 오류가 아니라 해당 행의 수동 확인 상태다.
- (VAI-7c) 정상 완료는 작은 `판단 완료 · 완료 시각` 텍스트로만 표시하고, `확인 중`·`수동 확인`·`다시 확인 필요`만 상태 칩으로 강조한다. `AI 다시 확인`은 판단 영역에만 두며 사용자 확정 액션과 섞지 않는다.
- (VAI-7c 오너 승인) [VAT HTML Preview](./previews/03_vat.html)의 상태 배치와 어휘를 승인했으며 runtime도 같은 계약을 사용한다.

## 8. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 (4d. 부가세)
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **UI_Screens**: [Bookkeeping Review Prototype Review](./04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) - 선행 화면(기장검토)
- **UI_Screens**: [HTML Preview](./previews/03_vat.html) - 브라우저 확인용 프로토타입
- **Technical_Specs**: [VAT AI Tax Treatment Completion Contract](../03_Technical_Specs/44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md) - JC-035 완료선·실행 순서
- **Technical_Specs**: [VAT Screen Simplification Brief](../03_Technical_Specs/48_VAT_SCREEN_SIMPLIFICATION_AND_DEDUPLICATION_BRIEF.md) - JC-038 중복 제거·삭제 원칙·Preview 재승인
