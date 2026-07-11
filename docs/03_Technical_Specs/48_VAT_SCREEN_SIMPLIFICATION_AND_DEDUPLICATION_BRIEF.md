# VAT Screen Simplification and Deduplication Brief
> Created: 2026-07-12
> Last Updated: 2026-07-12
> Backlog: JC-038 · VUI-1
> Status: current-screen audit complete; exact removal list pending project-owner discussion

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

## 2. Current Runtime Inventory

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

## 3. Deduplication Rules

### 3.1 One Fact, One Primary Location

- 예상 납부세액은 세액 요약에서 한 번만 강조한다.
- 사용자 처리 건수와 차단 이유는 하나의 처리 필요 위치에서만 보여준다.
- 같은 매입 거래의 공제 판단은 두 개의 표에 동시에 노출하지 않는다.
- 영세율·면세·공제 판단 근거는 해당 거래 행 또는 상세 팝오버 한 곳에서만 보여준다.
- package/readiness는 완료 단계에서만 자세히 보여주고 작업 중에는 짧은 상태만 둔다.

### 3.2 Remove Non-Operational Content

- 실제 화면에서 Loading·Empty·Error를 동시에 예시로 전시하지 않는다.
- 동작하지 않는 selector·버튼·미래 기능 placeholder를 표시하지 않는다.
- 같은 책임 경계와 안내 문구를 화면 여러 곳에 반복하지 않는다.
- 개발·Preview·QA 설명을 사용자 화면에 노출하지 않는다.
- 사용자가 지금 할 수 없는 작업을 큰 카드로 차지하게 하지 않는다.

### 3.3 Action-First Hierarchy

기본 화면 우선순위는 다음으로 고정한다.

1. 예상 납부·환급 세액
2. 지금 처리할 거래
3. 처리 완료 후 신고 준비 상태

과세·영세율·면세 통계, 부속명세, 감사 상세, AI trace는 필요할 때 펼쳐보는 2차 정보다.

## 4. Candidate Decisions for Owner Review

다음 논의에서 각 항목을 **유지, 통합, 접기, 삭제** 중 하나로 확정한다.

| 검토 항목 | 권장안 | 확정 전 확인할 질문 |
|:---|:---|:---|
| 화면 상태 예시 | 삭제 | 실제 runtime에서 사용자 가치가 있는가? |
| 매입세액 공제 검토 표 | AI 판단 표의 매입 행으로 통합 | 기존 mutation을 단일 표에서 모두 수행할 수 있는가? |
| 매출 구분 3카드 | 한 줄 요약 또는 접기 | 신고 전 항상 보여야 하는가? |
| 부속 명세 | compact status 또는 완료 단계 접기 | 거래 처리 중 매번 확인해야 하는가? |
| 신고 패키지 미리보기 | Path 1b 용어로 재정의하고 축소 | 현재 실제 생성물·사용자 행동과 일치하는가? |
| 책임 경계 안내 | 상시 카드 제거, 도움말/짧은 주석 이동 | 법적 경계를 유지하면서 반복을 줄일 수 있는가? |
| 판단 표 열·보조 문구 | 한 줄 결론 우선, 상세는 팝오버 | 한 화면에서 반드시 보여야 할 최소 필드는 무엇인가? |
| 상단 확정 신고 | 실제 동작이 없다면 삭제 | 사용자 선택 가능한 신고 유형이 실제로 존재하는가? |

이 표는 삭제 명령이 아니라 논의용 inventory다. 프로젝트 오너가 화면을 보며 확정한 결과를
Preview와 UI 문서에 반영한 뒤 코드 작업으로 넘긴다.

## 5. Fixed Work Order

| 작업 단위 | 내용 | 완료선 |
|:---|:---|:---|
| **VUI-1a · Inventory Decision** | 현재 영역을 유지/통합/접기/삭제로 확정 | 프로젝트 오너가 항목별 결정을 승인 |
| **VUI-1b · Preview Simplification** | 03_vat.html을 결정안대로 단순화 | 실제 크기 브라우저에서 정보 중복·첫 화면 밀도 승인 |
| **VUI-1c · Runtime Cut** | 승인된 삭제·통합만 runtime에 반영 | VAT mutation·gate·canonical 계산 회귀 없음 |
| **VUI-1d · Visual and Workflow QA** | desktop/mobile·빈/오류·처리 흐름 검증 | 겹침 없음, 핵심 작업까지 이동·클릭 수 감소, 문서 정합 |

JC-037 로딩 개선과 병렬 문서화할 수 있지만 runtime 작업은 충돌을 피하도록 순서를 정한다.
권장 순서는 **VUI-1b Preview 승인 → JC-037 구현 → VUI-1c runtime 정리**다.

## 6. Acceptance Criteria

- [ ] 프로젝트 오너가 모든 현재 영역을 유지/통합/접기/삭제 중 하나로 확정한다.
- [ ] live 화면에서 화면 상태 예시 같은 Preview 전용 콘텐츠가 사라진다.
- [ ] 같은 매입 거래의 공제 판단을 두 개의 표에서 반복하지 않는다.
- [ ] 동일 숫자·상태·차단 이유가 여러 카드에 중복 노출되지 않는다.
- [ ] 첫 화면에서 예상 세액과 처리 필요 거래가 우선 보인다.
- [ ] 실제 동작이 없는 control과 미래 기능 placeholder가 없다.
- [ ] 삭제 후에도 사용자 확정·증빙 확인·되돌리기·gate·세액 계산은 유지된다.
- [ ] desktop/mobile에서 표·버튼·팝오버 겹침과 수평 페이지 overflow가 없다.
- [ ] Preview·Prototype Review·UI Design·Backlog·QA가 runtime과 일치한다.

## 7. Out of Scope

- 이 docs 단계에서 실제 컴포넌트 삭제
- JC-035 세무 판단 규칙·AI 추천 정확도 변경
- JC-037 결과 캐시·비동기 로딩 구현
- VAT 세액 계산·provenance·package gate 로직 변경
- 홈택스 자동 제출

## 8. Related Documents

- **UI_Screens**: [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [VAT HTML Preview](../02_UI_Screens/previews/03_vat.html) · [UI Design §4.4](../02_UI_Screens/01_UI_DESIGN.md)
- **Technical_Specs**: [JC-035 Completion Contract](./44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md) · [JC-037 Loading Brief](./47_VAT_AI_LOADING_AND_RESULT_REUSE_PRE_CODE_BRIEF.md)
- **Logic_Progress**: [Backlog JC-038](../04_Logic_Progress/00_BACKLOG.md)
- **QA_Validation**: [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md)
