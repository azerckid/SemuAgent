# VAT Screen Simplification and Deduplication Brief
> Created: 2026-07-12
> Last Updated: 2026-07-12
> Backlog: JC-038 · VUI-1
> Status: owner decisions reflected in runtime; final visual QA pending

## 0. Decision

현재 부가세 화면은 기능을 계속 추가하면서 **같은 판단·상태·차단 이유를 여러 영역에서
반복 표시하고, 프리뷰 검증용 요소까지 실제 화면에 남아 시각적 부담이 커졌다.**

JC-038의 목표는 새 기능 추가가 아니다.

- 사용자가 지금 확인하거나 수정할 항목을 가장 먼저 본다.
- 같은 정보는 한 번만 보여준다.
- 업무에 쓰이지 않는 설명·예시·미래 기능은 화면에서 제거한다.

기존 JC-035 기능과 canonical VAT data는 유지한다. 이번 문서는 삭제·통합 원칙과 현재 영역
inventory를 먼저 고정한다. **어떤 영역을 실제로 삭제할지는 프로젝트 오너와 다음 화면
논의에서 확정하고, Preview 승인 전 runtime 코드를 수정하지 않는다.**

## 1. Primary User Job

부가세 화면의 1차 목표는 다음 세 가지다.

1. 현재 예상 납부·환급 세액을 확인한다.
2. 홈택스 자동채움 내용 중 그대로 둘 항목과 수정·추가 확인할 항목을 처리한다.
3. 미확정 항목이 모두 끝났는지 확인하고 신고 준비 단계로 이동한다.

화면의 모든 영역은 위 세 가지 중 하나에 직접 기여해야 한다. 기여하지 않거나 다른 영역과
같은 내용을 반복하면 삭제·통합·접기 후보로 분류한다.

## 2. Hometax Prefill and Exception-First Model

### 2.1 Confirmed Filing Context

국세청은 전자세금계산서·신용카드·현금영수증 등 보유 자료를 부가세 신고서에 미리 채우는
서비스를 제공한다. 2026년 1기 예정신고 안내 기준 미리채움 항목은 25종이며, 사용자는
미리채움 자료에서 추가·수정이 필요한 항목을 고칠 수 있다.

- [국세청 2026년 1기 부가가치세 예정신고 안내](https://www.nts.go.kr/nts/na/ntt/selectNttInfo.do?mi=2201&nttSn=1350085)
- [국세청 부가가치세 신고 동영상 자료](https://www.nts.go.kr/nts/na/ntt/selectNttList.do?bbsId=131039&mi=40327)

따라서 SemuAgent가 홈택스에 이미 정상 반영될 가능성이 높은 모든 거래를 다시 한 건씩
심사하도록 요구하는 것은 사용자의 실제 신고 흐름과 맞지 않는다.

### 2.2 Default Handling

다음 조건을 모두 만족하는 거래는 **정상 자동 정리** 대상으로 묶어 기본 화면에서 접는다.

- 전자세금계산서·사업용 카드·현금영수증 등 식별 가능한 전자증빙이 있다.
- 공급가액·세액·합계액 또는 승인금액이 정확히 일치한다.
- 취소·중복·누락·기간 오류 신호가 없다.
- 공식 deterministic rule상 과세·일반 공제처럼 명확하다.
- AI 또는 이전 패턴만으로 정상이라고 판단한 것이 아니다.

정상 자동 정리는 세무 확정이나 홈택스 제출이 아니다. 사용자는 거래마다 반복 확정하지 않고,
기간 단위 요약에서 **정상 반영 예정 N건**과 합계액을 확인한 뒤 최종 신고 준비를 승인한다.

### 2.3 Exception Queue

아래 항목만 기본 작업대에 펼쳐서 보여준다.

- 영세율·면세 요건과 필수 증빙 확인
- 불공제 가능 매입과 공통매입 안분
- 전자증빙에 잡히지 않는 현금·계좌·플랫폼 매출 누락 가능성
- 취소·환불·중복·기간 오류
- 증빙과 원장의 거래처·금액·세액 불일치
- 필요한 사실이나 증빙 부족
- 규칙·사용자 과거 결정·AI 판단 불일치

예외가 0건이면 긴 판단표를 보여주지 않고 짧은 완료 배너만 보여준다.
예외가 있으면 **확인 필요 N건**을 우선 표시하고 정상 건은 기본 작업대에 펼치지 않는다.

### 2.4 Prefill Is Not Final Tax Treatment

홈택스 미리채움은 자료를 신고서에 가져오는 기능이지 모든 공제·영세율·면세·안분 판단이
자동으로 올바르다는 보장은 아니다. SemuAgent는 이 차이를 숨기지 않는다.

- 전자증빙과 deterministic rule이 명확한 정상 건: 자동 정리
- 세무 판단이 필요한 건: 예외 큐
- 최종 신고 내용과 제출: 사용자 기간 단위 확인

### 2.5 AI Conclusion Is Not a Generic Handoff

예외 큐에 남은 거래도 `확인 필요` 또는 `담당자 판단 필요`라는 상태만 보여주면 안 된다.
[JC-039 · VAI-8](./50_VAT_AI_EVIDENCE_BACKED_DECISIVE_JUDGMENT_BRIEF.md)에 따라 AI는 정해진
자료와 공식 규칙을 먼저 찾고, **잠정 결론 -> 실제 근거 -> 홈택스 권장 행동**을 표시한다.
담당자 이관은 필수 사실 부재·근거 충돌·공식 규칙 공백/합의 실패일 때만 마지막 행동으로 둔다.

## 3. Current Runtime Inventory

| 현재 영역 | 현재 역할 | 확인된 문제 | 1차 분류 |
|:---|:---|:---|:---|
| 상단 breadcrumb·회사명·기간·확정 신고 | 위치·기간 표시 | 확정 신고가 실제 선택 동작 없이 보이면 가짜 control이 됨 | 유지/삭제 검토 |
| 세액 요약 Hero | 매출세액−공제 매입세액=납부 예정세액 | 예정치 안내와 하단 gate 설명이 반복될 수 있음 | 유지·문구 축소 |
| 매출 구분 3카드 | 과세·영세율·면세 공급가액·세액 | 넓은 면적을 차지하며 판단 표의 매출 분류와 일부 중복 | 압축/접기 검토 |
| AI 부가세 판단 표 | 거래별 판단·근거·증빙·홈택스 행동·사용자 확정 | 핵심 작업대지만 열과 보조 문구가 많아 인지 부담 큼 | 핵심 유지·단순화 |
| 매입세액 공제 검토 표 | 매입 거래별 공제/불공제 처리 | AI 판단 표의 매입 행과 같은 결정을 다시 보여줌 | 통합 우선 후보 |
| 부속 명세 | 첨부 서식 준비 상태 | package gate·판단 표의 상태와 중복될 수 있음 | 축약/접기 검토 |
| 신고 패키지 미리보기 | 검토 자료와 차단 이유 | VAT Path 1b 방향·하단 차단 사유와 정합 재검토 필요 | 재정의/축약 검토 |
| 화면 상태 예시 | Loading·Empty·Error 샘플 카드 | 실제 업무 데이터가 아닌 Preview/QA용 예시 | **삭제 우선 후보** |
| 책임 경계 안내 | 자동 제출·납부가 아님을 설명 | 다른 안내와 반복되고 상시 노출 시 부담 | 제거/도움말 이동 후보 |

## 4. Deduplication Rules

### 4.1 One Fact, One Primary Location

- 예상 납부세액은 세액 요약에서 한 번만 강조한다.
- 사용자 처리 건수와 차단 이유는 하나의 처리 필요 위치에서만 보여준다.
- 같은 매입 거래의 공제 판단은 두 개의 표에 동시에 노출하지 않는다.
- 영세율·면세·공제 판단 근거는 해당 거래 행 또는 상세 팝오버 한 곳에서만 보여준다.
- package/readiness는 화면에서 반복하지 않고 서버 API gate에서만 강제한다.

### 4.2 Remove Non-Operational Content

- 실제 화면에서 Loading·Empty·Error를 동시에 예시로 전시하지 않는다.
- 동작하지 않는 selector·버튼·미래 기능 placeholder를 표시하지 않는다.
- 같은 책임 경계와 안내 문구를 화면 여러 곳에 반복하지 않는다.
- 개발·Preview·QA 설명을 사용자 화면에 노출하지 않는다.
- 사용자가 지금 할 수 없는 작업을 큰 카드로 차지하게 하지 않는다.

### 4.3 Action-First Hierarchy

기본 화면 우선순위는 다음으로 고정한다.

1. 예상 납부·환급 세액
2. 지금 처리할 거래
3. 예외가 없다는 완료 상태

과세·영세율·면세 통계, 부속명세, 감사 상세, AI trace는 필요할 때 펼쳐보는 2차 정보다.

## 5. Approved Owner Decisions

2026-07-12 프로젝트 오너가 실제 크기 Preview를 확인하고 다음 10개 결정을 승인했다.

| 검토 항목 | 최종 결정 | runtime 계약 |
|:---|:---|:---|
| 화면 상태 예시 | 삭제 | Loading·Empty·Error 데모 카드를 live 화면에 두지 않는다. |
| 매입세액 공제 검토 표 | 통합 | AI 판단 행과 기존 공제 검토 행을 `확인 필요 거래` 작업대 한 곳에서 처리한다. 기존 mutation은 유지한다. |
| 매출 구분 3카드 | 유지 | 과세·영세율·면세 3카드는 접지 않고 항상 표시한다. |
| 부속 명세 | 삭제 | 별도 대형 카드로 반복 표시하지 않는다. |
| 신고 패키지 미리보기 | 화면에서 삭제 | package/rebuild API gate는 유지하되 부가세 작업 화면에서 준비 상태·차단 이유·완료 버튼을 반복 표시하지 않는다. |
| 책임 경계 안내 | 도움말로 축소 | 상시 카드·하단 문구를 제거하고 세액 요약의 도움말에서만 제공한다. |
| 판단 표 열·보조 문구 | 3열로 통합 | `거래/상대처`, `금액`, `공제 판단`만 둔다. 기본 상태는 `공제 가능`·`공제 불가`·`자료 부족`이며 매출은 `과세유형 확인`으로 분리한다. 홈택스 할 일·근거·증빙·AI 상태·사용자 확정 액션은 판단을 펼친 뒤 표시한다. |
| 상단 확정 신고 | 삭제 | 실제 동작이 없는 control을 제거한다. |
| 정상 거래 표시 | 별도 요약 배너 삭제 | 정상 건은 예외 작업대에 펼치지 않되 중복 건수·합계 배너를 새로 만들지 않는다. |
| 예외 작업대 | 유지·강화 | 영세율·면세·불공제·안분·누락·취소·중복·불일치와 미완료 공제 검토만 기본 노출한다. 예외가 0건이면 완료 배너로 대체한다. |

Preview 승인본은 [03_vat.html](../02_UI_Screens/previews/03_vat.html)이며, VUI-1c는 위 결정을
그대로 runtime에 옮기되 VAT canonical 계산·mutation·undo와 package/rebuild API gate를 삭제하지 않는다.

## 6. Fixed Work Order

| 작업 단위 | 내용 | 완료선 |
|:---|:---|:---|
| **VUI-1a · Inventory Decision** | 현재 영역을 유지/통합/접기/삭제로 확정 | 프로젝트 오너가 항목별 결정을 승인 |
| **VUI-1b · Preview Simplification** | 03_vat.html을 결정안대로 단순화 | 실제 크기 브라우저에서 정보 중복·첫 화면 밀도 승인 |
| **VUI-1c · Runtime Cut** | 승인된 삭제·통합만 runtime에 반영 | VAT mutation·gate·canonical 계산 회귀 없음 |
| **VUI-1d · Visual and Workflow QA** | desktop/mobile·빈/오류·처리 흐름 검증 | 겹침 없음, 핵심 작업까지 이동·클릭 수 감소, 문서 정합 |

JC-037 로딩 개선과 병렬 문서화할 수 있지만 runtime 작업은 충돌을 피하도록 순서를 정한다.
권장 순서는 **VUI-1b Preview 승인 → JC-037 구현 → VUI-1c runtime 정리**다.
단, Preview의 예외 행 결론 구조는 JC-039 VAI-8a 계약을 먼저 반영해 generic `확인 필요`를
새 화면의 핵심 라벨로 굳히지 않는다.

## 7. Acceptance Criteria

- [x] 프로젝트 오너가 모든 현재 영역을 유지/통합/접기/삭제 중 하나로 확정한다.
- [x] live 화면에서 화면 상태 예시 같은 Preview 전용 콘텐츠가 사라진다.
- [x] 같은 매입 거래의 공제 판단을 두 개의 표에서 반복하지 않는다.
- [x] 동일 숫자·상태·차단 이유가 여러 카드에 중복 노출되지 않는다.
- [x] 첫 화면에서 예상 세액과 처리 필요 거래가 우선 보인다.
- [x] 명확한 정상 거래는 예외 작업대에 펼치지 않고 거래별 반복 확정을 요구하지 않는다.
- [x] 영세율·면세·불공제·안분·누락·취소·중복·금액 불일치 등 예외만 기본 작업대에 펼친다.
- [x] 예외 행은 단독 `확인 필요` 대신 잠정 결론·실제 근거·홈택스 권장 행동을 먼저 표시한다.
- [ ] 담당자 이관은 JC-039 Human Handoff Gate를 통과한 행에만 표시한다.
- [x] 예외 0건이면 긴 판단표 대신 짧은 완료 배너만 보여준다.
- [x] 자동 정리는 AI 단독 판단으로 만들지 않고 전자증빙·정확한 금액·deterministic rule을 요구한다.
- [x] 사용자는 기간 단위 최종 신고 내용을 명시적으로 확인한다.
- [x] 실제 동작이 없는 control과 미래 기능 placeholder가 없다.
- [x] 삭제 후에도 판단 상세 안의 사용자 확정·증빙 확인·되돌리기와 서버 gate·세액 계산은 유지된다.
- [ ] desktop/mobile에서 표·버튼·팝오버 겹침과 수평 페이지 overflow가 없다.
- [x] Preview·Prototype Review·UI Design·Backlog·QA가 runtime과 일치한다.

VUI-1d desktop 검증은 통과했다. 430px mobile에서는 VAT 내부 표가 `overflow-x-auto` 안에
격리되지만 전역 고정 Sidebar와 샘플 데이터 배너가 page overflow를 만드는 기존 공통 레이아웃
문제가 남아 있어 mobile acceptance는 후속 공통 레이아웃 작업 전까지 미완료로 유지한다.

## 8. Out of Scope

- 이 docs 단계에서 실제 컴포넌트 삭제
- JC-035 세무 판단 규칙·AI 추천 정확도 변경
- JC-037 결과 캐시·비동기 로딩 구현
- VAT 세액 계산·provenance·package gate 로직 변경
- 홈택스 자동 제출

## 9. Related Documents

- **UI_Screens**: [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [VAT HTML Preview](../02_UI_Screens/previews/03_vat.html) · [UI Design §4.4](../02_UI_Screens/01_UI_DESIGN.md)
- **Technical_Specs**: [JC-035 Completion Contract](./44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md) · [JC-037 Loading Brief](./47_VAT_AI_LOADING_AND_RESULT_REUSE_PRE_CODE_BRIEF.md) · [JC-039 Evidence-Backed Decisive Judgment Brief](./50_VAT_AI_EVIDENCE_BACKED_DECISIVE_JUDGMENT_BRIEF.md)
- **Logic_Progress**: [Backlog JC-038](../04_Logic_Progress/00_BACKLOG.md)
- **QA_Validation**: [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md)
