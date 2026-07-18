# SemuAgent Execution Plan - Sebiseo CUI-4 Closeout to CUI-6
> Created: 2026-07-18 19:34
> Last Updated: 2026-07-19
> Status: S1 Closeout·#286 완료 · S2 Preview 오너 화면 확인 대기

## 1. Context

이 문서는 세비서 CUI-4 잔여 작업을 닫고, CUI-4d 거래 단위 read-only 연결을 거쳐 CUI-5
구조화 확정과 CUI-6 통합 검증으로 이동하는 고정 작업순서를 정의한다.

제품 정본은 [세비서 중심 업무 운영모델](../01_Concept_Design/05_SEBISEO_OPERATING_MODEL.md)이다.
이 실행계획은 운영모델 전체를 한 번에 구현하지 않고, 다음 첫 세로 흐름으로 계약을 검증한다.

```text
업로드 결과
  -> 확인 필요 거래
  -> 필터된 자료대조원장
  -> 구조화 확인·확정
  -> 감사·undo
  -> 세비서 상태 재조회
```

## 2. Execution Decision

- [x] CUI-5는 다음 큰 구현 단계로 유지한다.
- [x] 현재 CUI-4는 파일 단위 결과 카드까지만 구현했으므로 거래 단위 연결을 CUI-4d로 보완한다.
- [x] CUI-4d는 read-only 집계와 navigation만 담당하고 canonical mutation을 하지 않는다.
- [x] CUI-5 첫 대상은 자료대조원장의 거래 검토·계정항목 확정 흐름으로 제한한다.
- [x] 세비서는 CUI-5에서 read-only 상태 조회와 화면 이동만 수행한다.
- [x] 첫 세목별 Readiness Spec은 부가세로 검증한다.
- [x] 범용 업무 상태 테이블과 모든 세목 확장은 첫 세로 흐름 검증 뒤에 설계한다.

## 3. Current Baseline

- [x] CUI-1 대화형 첫 화면 HTML Preview 승인
- [x] CUI-2 read-only 셸·첫 진입·참고 일정 구현
- [x] CUI-3 업로드·화이트리스트 대화·화면 라우팅 구현과 QA
- [x] CUI-4 Preview·Pre-Code Brief 승인
- [x] CUI-4a 최근 업로드 파일 결과 카드와 세션 필터 runtime 머지
- [ ] CUI-4 browser follow-up 완료
- [ ] 업로드 직후 카드 갱신·system 링크 일원화 잔여 확인
- [ ] QA 13 잔여 시나리오와 자료수집 회귀 완료
- [ ] 진행상황 카드 레이아웃 변경 검증과 별도 PR 정리

## 4. Fixed Execution Order

### S0. 운영모델·실행계획 Gate

- [ ] 운영모델 Draft PR 승인·머지
- [ ] 본 실행계획의 CUI-4d·CUI-5 범위 오너 승인
- [ ] JC-043 Backlog의 Related Concept·Execution Plan 링크 확인
- [ ] Open Decision은 유지하되 CUI-5 한정 OD-02 기본값 확인

Gate Out:

- [ ] 운영모델과 실행계획이 구현 입력 문서로 연결됨
- [ ] CUI-5에서 채팅·카드 canonical mutation 금지가 명시됨

### S1. CUI-4 Closeout

- [ ] 로그인 staging에서 최근 업로드 카드 표시를 실측
- [ ] CTA가 같은 `period + sessionId` 자료수집 화면을 여는지 실측
- [ ] R-04 tenant·사업장·기간·세션 격리를 브라우저에서 확인
- [ ] R-09 같은 기간 다른 세션 파일 혼입 0건을 브라우저에서 확인
- [ ] 업로드 직후 `router.refresh()` 또는 승인된 동등 경로로 카드가 갱신되는지 확인
- [ ] 업로드 성공 system 링크가 결과 카드 CTA와 중복되지 않는지 확인
- [ ] QA 13 잔여 시나리오 통과
- [ ] 자료수집 `sessionId` 없는 일반 진입과 기존 업로드 회귀 통과
- [ ] 진행상황 카드 데스크톱·모바일 레이아웃 검증
- [ ] Concept·Screen Flow·Brief·Backlog·QA 상태 동기화

Gate Out:

- [ ] CUI-4a~4c의 미완료 항목 0건
- [ ] CUI-4 runtime PR과 문서 PR 범위가 분리됨

### S2. First Vertical Journey HTML Preview

- [x] 업로드 결과에서 거래 단위 확인 필요 상태로 전환되는 화면 설계
- [x] 파일 건수와 거래 건수를 시각적·문구상 구분
- [x] 확인 필요 거래 CTA와 필터된 자료대조원장 진입 설계
- [x] 확인 전, 적용 직전, stale, 성공, undo, 부분 실패 상태 설계
- [x] 확정 후 세비서 상태 카드 재조회 결과 설계
- [x] 직접 사이드바 진입과 AI 장애 복구 경로 유지
- [x] 데스크톱·모바일 HTML Preview 제작 — [20_sebiseo_first_vertical_journey.html](../02_UI_Screens/previews/20_sebiseo_first_vertical_journey.html)
- [ ] 오너 화면 확인과 피드백 기록 — [Prototype Review](../02_UI_Screens/19_SEBISEO_FIRST_VERTICAL_JOURNEY_PROTOTYPE_REVIEW.md)
- [x] Screen Flow·UI Design·Prototype Review 링크 동기화

Gate Out:

- [ ] HTML UI Preview Gate 통과
- [ ] UI-First Gate 통과

### S3. CUI-4d Pre-Code Brief and QA Draft

- [ ] 거래 단위 확인 필요 read model의 데이터 소스 확정
- [ ] `tenant + 사업자 + 기간 + session/source scope` 필터 계약 확정
- [ ] 파일 상태와 거래 상태의 집계 단위 분리
- [ ] 확인 필요 거래 수와 필터된 행 집합의 1:1 대응 계약
- [ ] CTA URL·허용 query·서버 재검증 계약
- [ ] 잘못된·다른 tenant·다른 기간 query의 fail-closed 처리 확정
- [ ] 카드와 CTA가 mutation을 수행하지 않는 테스트 작성
- [ ] 로딩·빈 상태·오류·권한 없음 QA 시나리오 작성
- [ ] 기존 자료수집·자료대조원장 회귀 범위 명시
- [ ] Brief·QA 오너 승인

Gate Out:

- [ ] Pre-Code Technical Brief Gate 통과
- [ ] CUI-4d runtime 구현 허용

### S4. CUI-4d Runtime

- [ ] 거래 단위 read model을 기존 bookkeeping 자산에서 구성
- [ ] 확인 필요 거래 action card를 실제 DB 상태에서 렌더
- [ ] 필터된 자료대조원장 deep link 구현
- [ ] tenant·사업자·기간·행 scope 서버 재검증 구현
- [ ] 카드 클릭 navigation-only 보장
- [ ] 단위·통합·브라우저 테스트 통과
- [ ] CUI-4d 문서 상태와 Backlog 동기화

Gate Out:

- [ ] 사용자가 정확한 확인 대상 행을 구조화 화면에서 열 수 있음
- [ ] CUI-5가 확정할 대상과 fingerprint 입력 범위가 식별됨

### S5. CUI-5 Pre-Code Brief and QA Draft

- [ ] 첫 확정 대상과 허용 mutation을 자료대조원장 거래 행으로 제한
- [ ] 적용 대상·이전 값·제안 값·근거·영향 표시 계약
- [ ] tenant·사업자·기간·권한·현재 상태 서버 gate 계약
- [ ] 확인 대상 fingerprint 생성·비교·stale 응답 계약
- [ ] 중복 클릭과 재전송 멱등성 계약
- [ ] 확인자·시각·이전 값·새 값·근거 감사 계약
- [ ] shallow undo 대상·유효 범위·만료·불가 조건 확정
- [ ] 부분 성공·부분 실패와 사용자 문구 계약
- [ ] 확정 후 세비서 canonical 상태 재조회 계약
- [ ] VAT tax-treatment fingerprint·undo와 기존 reconciliation 자산의 재사용 범위 기록
- [ ] CUI-5 HTML Preview와 Brief·QA 정합 확인
- [ ] Brief·QA 오너 승인

Gate Out:

- [ ] CUI-5 mutation·상태·실패·감사·undo 계약 확정
- [ ] CUI-5 runtime 구현 허용

### S6. CUI-5 Runtime Slices

#### CUI-5a. Review Target Contract

- [ ] 대상 행·현재 값·제안 값·근거·fingerprint 표시
- [ ] 다른 사업자·기간·행 접근 차단
- [ ] 확인 전 canonical 상태 무변경 검증

#### CUI-5b. Structured Confirmation

- [ ] 구조화 화면의 명시적 확인에서만 mutation 실행
- [ ] 서버 gate와 fingerprint 재검증
- [ ] stale 충돌 시 적용하지 않고 최신 상태 재검토 요구
- [ ] 중복 요청 멱등 처리

#### CUI-5c. Audit and Undo

- [ ] 확인자·시각·변경 전후·fingerprint 감사 기록
- [ ] 최신 안전 변경에 한정한 shallow undo
- [ ] undo도 별도 감사 행위로 기록
- [ ] 외부 제출·비가역 동작을 undo로 표현하지 않음

#### CUI-5d. Sebiseo Feedback Loop

- [ ] mutation 성공 후 canonical 상태 재조회
- [ ] 확인 필요 건수와 다음 행동 갱신
- [ ] 확인 필요 0건을 신고 Ready로 자동 단정하지 않음
- [ ] 채팅 이력과 무관하게 재진입 시 상태 복구

#### CUI-5e. Verification

- [ ] tenant·사업자·기간 격리 테스트
- [ ] 두 탭 동시 수정·stale fingerprint 테스트
- [ ] 중복 클릭·재전송 테스트
- [ ] 부분 실패·undo 성공·undo 거절 테스트
- [ ] 세비서·자료대조원장 상태 정합 테스트
- [ ] 금지 발화와 숨은 mutation 회귀 테스트
- [ ] 데스크톱·모바일·키보드·스크린리더 브라우저 테스트

Gate Out:

- [ ] 업로드부터 구조화 확정과 상태 피드백까지 첫 세로 흐름 완료
- [ ] CUI-5 문서·코드·QA 동기화

### S7. VAT Readiness Pilot

- [ ] 공통 Ready gate와 부가세 세목별 gate 분리
- [ ] 부가세 필수 자료·처리·검토·snapshot·fingerprint 조건 정의
- [ ] blocker 코드와 사용자 해소 행동 정의
- [ ] Ready 무효화와 `STALE` 전이 정의
- [ ] Path 1a·1b validation과 Ready 관계 정의
- [ ] 부가세 상태 카드 HTML Preview와 Brief·QA 승인
- [ ] 부가세 첫 적용 후 원천세·지급명세서·연간신고 확장 여부 검토

### S8. CUI-6 Integrated Validation

- [ ] 세 가지 핵심 여정 E2E
- [ ] 최초 로드 LLM provider 0회 회귀
- [ ] 성능 목표와 느린 백그라운드 작업 비차단 확인
- [ ] 데스크톱·모바일·키보드·스크린리더·명암 검증
- [ ] 오류·빈 상태·권한 없음·provider 장애 복구 검증
- [ ] 기존 사이드바 직접 진입과 세무 워크스페이스 회귀
- [ ] 보안·tenant 격리·민감정보 redaction 검증
- [ ] 최종 문서·Backlog·QA 동기화

## 5. Dependency Rules

- [x] S1 runtime 마감 전에도 S2 문서 설계는 병행할 수 있다.
- [x] S2 승인 전 S3·S5 runtime을 구현하지 않는다.
- [x] S3 승인 전 CUI-4d runtime을 구현하지 않는다.
- [x] CUI-4d가 정확한 검토 대상을 열기 전 CUI-5 mutation을 연결하지 않는다.
- [x] CUI-5 첫 세로 흐름을 검증하기 전 범용 업무 테이블을 만들지 않는다.
- [x] 부가세 Readiness Spec 승인 전 부가세 Ready 카드가 완료를 단정하지 않는다.
- [x] 각 slice는 문서, runtime, QA 변경을 검토 가능한 단위로 분리한다.

## 6. Scope Boundaries

### Included

- [x] 최근 업로드에서 확인 필요 거래로 이어지는 read-only 지휘 루프
- [x] 자료대조원장 구조화 확인·확정
- [x] fingerprint·감사·shallow undo
- [x] 확정 후 세비서 상태 피드백
- [x] 부가세 첫 Readiness Spec

### Excluded from This Plan

- [x] 채팅·카드에서 canonical mutation
- [x] 모든 세목의 Ready 동시 구현
- [x] 범용 장기 실행 에이전트와 임의 도구 호출
- [x] 장기 대화 이력 DB
- [x] 외부 메시지 알림 채널
- [x] 자동 홈택스·위택스 제출·납부
- [x] 수정·재신고 전체 모델

## 7. Completion Criteria

- [ ] CUI-4 잔여 브라우저·회귀 항목이 모두 닫힘
- [ ] 사용자가 실제 확인 필요 거래만 필터된 자료대조원장에서 확인 가능
- [ ] 구조화 확인 전에는 canonical 값이 바뀌지 않음
- [ ] mutation 직전 tenant·권한·fingerprint·도메인 gate 재검증
- [ ] stale·중복·부분 실패가 성공으로 표현되지 않음
- [ ] 감사와 shallow undo가 검증됨
- [ ] 확정 결과가 세비서 상태에 canonical read model로 반영됨
- [ ] 부가세 Ready가 LLM 발화가 아닌 기계적 규칙으로 판정됨
- [ ] CUI-6 E2E·성능·접근성·보안 검증 통과

## 8. Document Sync Checklist

- [ ] `05_SEBISEO_OPERATING_MODEL.md` 상태와 Open Decisions 동기화
- [ ] `04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md` Delivery Plan 동기화
- [ ] `00_SCREEN_FLOW.md` CUI-4d·CUI-5 사용자 흐름 동기화
- [ ] 관련 HTML Preview와 Prototype Review 링크 추가
- [ ] CUI-4d·CUI-5 Pre-Code Brief와 QA 링크 추가
- [ ] `00_BACKLOG.md` JC-043 단계·Gate·완료 상태 갱신
- [ ] `docs/README.md` 실행계획 링크 유지

## 9. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 자가신고 보조와 Path 1 책임 경계
- **Concept_Design**: [Conversational Tax Workspace Product Direction](../01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md) - CUI-0~6 방향과 신뢰 계약
- **Concept_Design**: [Sebiseo Operating Model](../01_Concept_Design/05_SEBISEO_OPERATING_MODEL.md) - 업무·상태·blocker·Ready·확인 운영 정본
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 현행 세비서 진입과 구조화 작업공간 흐름
- **UI_Screens**: [Sebiseo HTML Preview](../02_UI_Screens/previews/19_sebiseo.html) - CUI-4 현재 화면 확인 기준
- **Technical_Specs**: [CUI-3 Upload, Chat, Routing Brief](../03_Technical_Specs/62_JC043_CUI3_SEBISEO_UPLOAD_CHAT_PRE_CODE_BRIEF.md) - 대화·업로드·라우팅 기존 계약
- **Technical_Specs**: [CUI-4 Upload Result Card Brief](../03_Technical_Specs/63_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_PRE_CODE_BRIEF.md) - 파일 결과 카드와 session deep link 계약
- **Technical_Specs**: [Reconciliation Ledger V2 Brief](../03_Technical_Specs/41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md) - 첫 CUI-5 구조화 확정 재사용 자산
- **Technical_Specs**: [VAT AI Tax Treatment Brief](../03_Technical_Specs/46_VAT_AI_TAX_TREATMENT_PRE_CODE_BRIEF.md) - fingerprint·확인·undo 참고 계약
- **Logic_Progress**: [Backlog](./00_BACKLOG.md) - JC-043 상태와 Context Lock
- **QA_Validation**: [CUI-3 Test Scenarios](../05_QA_Validation/12_JC043_CUI3_SEBISEO_TEST_SCENARIOS.md) - 대화·업로드·라우팅 회귀
- **QA_Validation**: [CUI-4 Test Scenarios](../05_QA_Validation/13_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_TEST_SCENARIOS.md) - CUI-4 마감과 자료수집 회귀
